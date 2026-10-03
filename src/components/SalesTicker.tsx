import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Flag } from "@/components/Flag";
import { useCatalog, useTickerSettings } from "@/lib/catalog";

const FIRST_NAMES = [
  "Lucas", "Mariana", "Rafael", "Beatriz", "Thiago", "Camila", "Gustavo", "Larissa",
  "Fernando", "Juliana", "Bruno", "Patrícia", "Diego", "Amanda", "Rodrigo", "Carla",
  "Vinícius", "Aline", "Marcelo", "Renata", "Felipe", "Tatiane", "André", "Priscila",
  "Eduardo", "Vanessa", "Leandro", "Sabrina", "Caio", "Débora",
];

const LAST_NAMES = [
  "S.", "O.", "L.", "M.", "P.", "R.", "C.", "A.", "F.", "B.", "G.", "T.",
];

const PRODUCTS = ["eSIM virtual", "chip real", "número Business", "número WhatsApp"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

type Notice = {
  id: number;
  name: string;
  country: string;
  code: string;
  product: string;
  minutes: number;
};

export function SalesTicker() {
  const { catalog } = useCatalog();
  const { enabled, intervalMs } = useTickerSettings();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!enabled) {
      setNotice(null);
      return;
    }
    const active = catalog.filter((c) => c.active);
    if (active.length === 0) return;

    let hideTimer: ReturnType<typeof setTimeout>;

    const show = () => {
      const country = pick(active);
      setNotice({
        id: Date.now(),
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        country: country.name,
        code: country.code,
        product: pick(PRODUCTS),
        minutes: 1 + Math.floor(Math.random() * 9),
      });
      hideTimer = setTimeout(() => setNotice(null), 6000);
    };

    let interval: ReturnType<typeof setInterval> | undefined;
    let first: ReturnType<typeof setTimeout> | undefined;

    const start = () => {
      first = setTimeout(show, Math.min(4000, intervalMs));
      interval = setInterval(show, intervalMs);
    };
    const stop = () => {
      if (first) clearTimeout(first);
      if (interval) clearInterval(interval);
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        setNotice(null);
      } else {
        start();
      }
    };

    // Don't run timers while the tab is in the background — saves battery/CPU
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      clearTimeout(hideTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [catalog, enabled, intervalMs]);

  if (!notice) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-4 z-50 max-w-[92vw] sm:max-w-sm"
      aria-live="polite"
    >
      <div
        key={notice.id}
        className="neon-card animate-fade-in flex items-center gap-3 rounded-2xl border bg-card/95 p-3 shadow-card will-change-transform sm:backdrop-blur-md"
      >
        <Flag code={notice.code} name={notice.country} className="h-8 w-11 shrink-0 rounded-md object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {notice.name} comprou um {notice.product}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Número de {notice.country} · há {notice.minutes} min
          </p>
        </div>
        <span className="ml-auto grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Check className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
