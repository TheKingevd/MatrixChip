import crypto from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

function parseSignature(value: string | null) {
  let ts = "";
  let v1 = "";
  for (const part of value?.split(",") ?? []) {
    const [key, raw] = part.split("=", 2);
    if (key?.trim() === "ts") ts = raw?.trim() || "";
    if (key?.trim() === "v1") v1 = raw?.trim() || "";
  }
  return { ts, v1 };
}

export const Route = createFileRoute("/api/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { db } = await import("@/server/db");
        const secretRow = db.prepare("SELECT value FROM app_settings WHERE key = 'mercadopago_webhook_secret'").get() as { value?: string } | undefined;
        const secret = secretRow?.value?.trim() || process.env["MERCADOPAGO_WEBHOOK_SECRET"]?.trim();
        if (!secret) return Response.json({ error: "webhook not configured" }, { status: 503 });

        const url = new URL(request.url);
        const dataId = (url.searchParams.get("data.id") || "").toLowerCase();
        const requestId = request.headers.get("x-request-id") || "";
        const signature = parseSignature(request.headers.get("x-signature"));

        if (!dataId || !signature.ts || !signature.v1) {
          return Response.json({ error: "invalid signature" }, { status: 401 });
        }

        const manifest = `id:${dataId};request-id:${requestId};ts:${signature.ts};`;
        const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
        const a = Buffer.from(expected, "utf8");
        const b = Buffer.from(signature.v1, "utf8");

        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          return Response.json({ error: "invalid signature" }, { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as {
          type?: string;
          data?: { id?: string | number };
        };
        const paymentId = String(body.data?.id || dataId);
        if (body.type && body.type !== "payment") return Response.json({ ok: true });

        const tokenRow = db.prepare("SELECT value FROM app_settings WHERE key = 'mercadopago_access_token'").get() as { value?: string } | undefined;
        const token = tokenRow?.value?.trim() || process.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim();
        if (!token) return Response.json({ error: "gateway not configured" }, { status: 503 });

        const response = await fetch(
          `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
        );

        if (!response.ok) return Response.json({ error: "gateway lookup failed" }, { status: 502 });

        const payment = (await response.json()) as { status?: string };
        if (payment.status === "approved") {
          const sale = db.prepare(
            "SELECT id, customer_name, total, pix_status FROM sales WHERE payment_provider = 'mercadopago' AND payment_external_id = ?",
          ).get(paymentId) as
            | { id: string; customer_name: string; total: number; pix_status: string }
            | undefined;

          db.prepare(
            "UPDATE sales SET pix_status = 'confirmado', pix_confirmed_at = COALESCE(pix_confirmed_at, ?), status = CASE WHEN status = 'pendente' THEN 'pago' ELSE status END WHERE payment_provider = 'mercadopago' AND payment_external_id = ?",
          ).run(new Date().toISOString(), paymentId);

          if (sale && sale.pix_status !== "confirmado") {
            const { sendAdminPush } = await import("@/server/push");
            await sendAdminPush({
              title: "Pagamento confirmado",
              body: `Pedido ${sale.id} pago por ${sale.customer_name} — R$ ${Number(sale.total).toFixed(2).replace(".", ",")}.`,
              url: "/admin/historico",
              tag: `payment-confirmed-${sale.id}`,
            }).catch((error) => console.error("[matrix] push de pagamento:", error));
          }
        } else if (payment.status === "cancelled" || payment.status === "rejected") {
          db.prepare(
            "UPDATE sales SET status = 'cancelada' WHERE payment_provider = 'mercadopago' AND payment_external_id = ?",
          ).run(paymentId);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
