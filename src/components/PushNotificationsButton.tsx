import { Bell, BellRing, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getPushPublicKeyServerFn,
  subscribePushServerFn,
  unsubscribePushServerFn,
} from "@/lib/push.functions";

function isPushAvailable() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function PushNotificationsButton() {
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isPushAvailable()) return;

    void navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      setEnabled(Boolean(subscription && Notification.permission === "granted"));
    });
  }, []);

  if (!isPushAvailable()) return null;

  const enable = async () => {
    setBusy(true);
    try {
      if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone()) {
        throw new Error("No iPhone, primeiro instale o Matrix Online na Tela de Início.");
      }

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error("Permissão de notificações não concedida.");
      }

      const { publicKey } = await getPushPublicKeyServerFn();
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("O navegador não retornou uma assinatura de push válida.");
      }

      await subscribePushServerFn({
        data: {
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
        },
      });

      setEnabled(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível ativar as notificações.";
      window.alert(message);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePushServerFn({ data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setEnabled(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível desativar as notificações.";
      window.alert(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={enabled ? "secondary" : "outline"}
      className="h-8 text-xs"
      onClick={() => void (enabled ? disable() : enable())}
      disabled={busy}
      title={enabled ? "Notificações ativas" : "Ativar notificações"}
    >
      {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : enabled ? <BellRing className="mr-1.5 size-3.5" /> : <Bell className="mr-1.5 size-3.5" />}
      {enabled ? "Notificações ativas" : "Ativar notificações"}
    </Button>
  );
}
