import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (hidden || isStandalone()) return null;

  const install = async () => {
    if (installEvent) {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
      return;
    }

    if (isIos()) {
      setShowIosHelp(true);
    }
  };

  const supported = Boolean(installEvent) || isIos();
  if (!supported) return null;

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-4 sm:left-auto sm:max-w-sm">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
          <Download className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Instale o Matrix Online</p>
          <p className="text-xs text-muted-foreground">Use como aplicativo, sem a barra do navegador.</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => void install()}>
          Instalar
        </Button>
        <button
          type="button"
          aria-label="Fechar"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          onClick={() => setHidden(true)}
        >
          <X className="size-4" />
        </button>
      </div>

      {showIosHelp && (
        <div className="fixed inset-0 z-[70] grid place-items-end bg-black/50 p-4 sm:place-items-center">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Instalar no iPhone</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  No iPhone/iPad, a instalação é feita pelo menu Compartilhar.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setShowIosHelp(false)}
              >
                <X className="size-4" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-foreground">
              <li className="flex gap-3"><span className="font-bold text-primary">1.</span><span>Toque em <b>Compartilhar</b> no navegador.</span></li>
              <li className="flex gap-3"><span className="font-bold text-primary">2.</span><span>Escolha <b>Adicionar à Tela de Início</b>.</span></li>
              <li className="flex gap-3"><span className="font-bold text-primary">3.</span><span>Abra o Matrix Online pelo novo ícone.</span></li>
            </ol>
            <Button className="mt-5 w-full" onClick={() => setShowIosHelp(false)}>
              Entendi
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
