import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/asaas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { db } = await import("@/server/db");
        const body = (await request.json().catch(() => ({}))) as {
          payment?: { id?: string };
        };
        const paymentId = body.payment?.id;
        if (!paymentId) return Response.json({ ok: true });

        const tokenRow = db.prepare("SELECT value FROM app_settings WHERE key = 'asaas_access_token'").get() as { value?: string } | undefined;
        const token = tokenRow?.value?.trim() || process.env["ASAAS_ACCESS_TOKEN"]?.trim();
        if (!token) return Response.json({ error: "gateway not configured" }, { status: 503 });

        const baseRow = db.prepare("SELECT value FROM app_settings WHERE key = 'asaas_api_url'").get() as { value?: string } | undefined;
        const base = (baseRow?.value?.trim() || process.env["ASAAS_API_URL"]?.trim() || "https://api.asaas.com").replace(/\/$/, "");

        // Nunca confie no status enviado pelo webhook. O servidor consulta o Asaas
        // usando o token privado e só então decide se o pagamento foi pago.
        const response = await fetch(`${base}/v3/payments/${encodeURIComponent(paymentId)}/status`, {
          headers: { accept: "application/json", access_token: token },
        });
        if (!response.ok) return Response.json({ error: "gateway lookup failed" }, { status: 502 });

        const payment = (await response.json()) as { status?: string };
        if (payment.status === "RECEIVED" || payment.status === "CONFIRMED") {
          db.prepare(
            "UPDATE sales SET pix_status = 'confirmado', pix_confirmed_at = COALESCE(pix_confirmed_at, ?), status = CASE WHEN status IN ('pendente','erro_pagamento') THEN 'pago' ELSE status END WHERE payment_provider = 'asaas' AND payment_external_id = ?",
          ).run(new Date().toISOString(), paymentId);
        } else if (payment.status === "REFUNDED" || payment.status === "DELETED") {
          db.prepare(
            "UPDATE sales SET pix_status = 'aguardando', status = 'cancelada' WHERE payment_provider = 'asaas' AND payment_external_id = ?",
          ).run(paymentId);
        }

        return Response.json({ ok: true });
      },

    },
  },
});
