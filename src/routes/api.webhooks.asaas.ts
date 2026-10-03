import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/asaas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { db } = await import("@/server/db");
        const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'asaas_webhook_token'").get() as { value?: string } | undefined;
        const expected = setting?.value?.trim() || process.env["ASAAS_WEBHOOK_TOKEN"]?.trim();
        const received = request.headers.get("asaas-access-token")?.trim();

        if (!expected || !received || received !== expected) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const body = (await request.json()) as {
          event?: string;
          payment?: { id?: string; status?: string };
        };

        const paymentId = body.payment?.id;
        if (!paymentId) return Response.json({ ok: true });

        const paid = body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED";

        if (paid) {
          db.prepare(
            "UPDATE sales SET pix_status = 'confirmado', pix_confirmed_at = COALESCE(pix_confirmed_at, ?), status = CASE WHEN status = 'pendente' THEN 'pago' ELSE status END WHERE payment_provider = 'asaas' AND payment_external_id = ?",
          ).run(new Date().toISOString(), paymentId);
        } else if (body.event === "PAYMENT_REFUNDED" || body.event === "PAYMENT_DELETED") {
          db.prepare(
            "UPDATE sales SET pix_status = 'aguardando', status = 'cancelada' WHERE payment_provider = 'asaas' AND payment_external_id = ?",
          ).run(paymentId);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
