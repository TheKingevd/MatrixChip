import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(20).max(512),
    auth: z.string().min(8).max(512),
  }),
});

export const getPushPublicKeyServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/server/auth");
  requireAdmin();

  const { getPushPublicKey } = await import("@/server/push");
  return { publicKey: await getPushPublicKey() };
});

export const subscribePushServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => subscriptionSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    const user = requireAdmin();

    const { db } = await import("@/server/db");
    const { validatePushEndpoint } = await import("@/server/push");
    validatePushEndpoint(data.endpoint);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         updated_at = excluded.updated_at`,
    ).run(
      crypto.randomUUID(),
      user.id,
      data.endpoint,
      data.keys.p256dh,
      data.keys.auth,
      now,
      now,
    );

    return { ok: true as const };
  });

export const unsubscribePushServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ endpoint: z.string().url().max(2048) }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    const user = requireAdmin();

    const { db } = await import("@/server/db");
    db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?").run(
      data.endpoint,
      user.id,
    );

    return { ok: true as const };
  });
