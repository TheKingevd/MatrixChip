import { db } from "./db";
import { generateVapidKeys } from "@mmmike/web-push/vapid";
import { sendPushNotification, type PushSubscriptionData } from "@mmmike/web-push/send";

type StoredSubscription = PushSubscriptionData & {
  user_id: string;
};

type PushMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let vapidCache: { publicKey: string; privateKey: string; subject: string } | null = null;

function readSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value?.trim() || null;
}

async function getVapidConfig() {
  if (vapidCache) return vapidCache;

  let publicKey = readSetting("push_vapid_public_key");
  let privateKey = readSetting("push_vapid_private_key");

  if (!publicKey || !privateKey) {
    const generated = await generateVapidKeys();
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;

    const now = new Date().toISOString();
    const stmt = db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)",
    );
    stmt.run("push_vapid_public_key", publicKey, now);
    stmt.run("push_vapid_private_key", privateKey, now);
  }

  const subject =
    process.env["VAPID_SUBJECT"]?.trim() ||
    (process.env["ADMIN_EMAIL"]?.trim()
      ? `mailto:${process.env["ADMIN_EMAIL"].trim()}`
      : "mailto:admin@example.com");

  vapidCache = { publicKey, privateKey, subject };
  return vapidCache;
}

export async function getPushPublicKey(): Promise<string> {
  return (await getVapidConfig()).publicKey;
}

function allowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();
    return (
      host === "fcm.googleapis.com" ||
      host.endsWith(".push.services.mozilla.com") ||
      host === "push.services.mozilla.com" ||
      host.endsWith(".push.apple.com") ||
      host === "push.apple.com"
    );
  } catch {
    return false;
  }
}

export function validatePushEndpoint(endpoint: string): void {
  if (!allowedPushEndpoint(endpoint)) {
    throw new Error("Endpoint de notificação não suportado.");
  }
}

export async function sendAdminPush(message: PushMessage): Promise<void> {
  const subscriptions = db
    .prepare(
      `SELECT user_id, endpoint, p256dh, auth
       FROM push_subscriptions
       JOIN users ON users.id = push_subscriptions.user_id
       WHERE users.role = 'admin'`,
    )
    .all() as StoredSubscription[];

  if (subscriptions.length === 0) return;

  const vapid = await getVapidConfig();

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        const delivered = await sendPushNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          message,
          vapid,
          { ttl: 60 * 60, urgency: "high" },
        );

        if (delivered === false) {
          db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(subscription.endpoint);
        }
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(subscription.endpoint);
        } else {
          console.error("[matrix] Falha ao enviar push:", statusCode || error);
        }
      }
    }),
  );
}
