import { AlarmClock, Ticket } from "lucide-react";
import { Flag } from "@/components/Flag";
import {
  activeCoupons,
  couponScopeLabel,
  expiryLabel,
  isExpiringSoon,
  useCoupons,
} from "@/lib/coupons";
import { useCatalog } from "@/lib/catalog";

/** Vitrine de cupons ativos, exibida no site para os visitantes. */
export function CouponShowcase() {
  const { data } = useCoupons();
  const { catalog } = useCatalog();
  const coupons = activeCoupons(data);
  if (coupons.length === 0) return null;

  const countryName = (code: string) => catalog.find((c) => c.code === code)?.name;
  const ending = coupons.filter((c) => isExpiringSoon(c));

  return (
    <section id="cupons" className="mx-auto max-w-6xl px-5 py-16">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
          <Ticket className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Cupons de desconto</h2>
          <p className="text-sm text-muted-foreground">
            Informe o código no atendimento pelo WhatsApp para aplicar o desconto.
          </p>
        </div>
      </div>

      {ending.length > 0 && (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          <AlarmClock className="size-4 animate-pulse" />
          {ending.length === 1
            ? `Corra! O cupom ${ending[0]!.code} está acabando.`
            : `Corra! ${ending.length} cupons estão acabando nos próximos dias.`}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.map((c) => (
          <div
            key={c.id}
            className="neon-card heartbeat-glow rounded-2xl border border-border/70 bg-card p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-lg font-bold tracking-wider text-primary">
                {c.code}
              </span>
              <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
                -{Number(c.percent)}%
              </span>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              {c.country_code && (
                <Flag code={c.country_code} name={countryName(c.country_code) ?? ""} />
              )}
              {couponScopeLabel(c, countryName)}
            </p>
            {c.expires_at && (
              <p
                className={
                  isExpiringSoon(c)
                    ? "mt-2 inline-flex animate-pulse items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive"
                    : "mt-1 text-xs text-muted-foreground"
                }
              >
                {isExpiringSoon(c) ? <AlarmClock className="size-3" /> : null}
                {expiryLabel(c)}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
