import { useQuery } from "@tanstack/react-query";
import { getCouponsServerFn } from "@/lib/api.functions";

export type Coupon = {
  id: string;
  code: string;
  percent: number;
  country_code: string | null;
  number_type: string | null;
  active: boolean;
  expires_at: string | null;
};

export function useCoupons() {
  return useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const data = await getCouponsServerFn();
      return (data ?? []) as Coupon[];
    },
    staleTime: 5 * 60_000,
    gcTime: 7 * 24 * 60 * 60_000,
  });
}

/** Dias inteiros restantes até a expiração (null = sem validade). */
export function daysUntilExpiry(c: Coupon): number | null {
  if (!c.expires_at) return null;
  const ms = new Date(c.expires_at).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Cupom que acaba nos próximos dias (padrão: 3). */
export function isExpiringSoon(c: Coupon, withinDays = 3): boolean {
  const d = daysUntilExpiry(c);
  return d != null && d >= 0 && d <= withinDays;
}

/** Texto curto de contagem regressiva para exibir no site. */
export function expiryLabel(c: Coupon): string | null {
  const d = daysUntilExpiry(c);
  if (d == null) return null;
  if (d <= 0) return "Termina hoje!";
  if (d === 1) return "Último dia amanhã!";
  if (d <= 3) return `Faltam ${d} dias`;
  return `Válido até ${new Date(c.expires_at!).toLocaleDateString("pt-BR")}`;
}

function isExpired(c: Coupon) {
  return c.expires_at != null && new Date(c.expires_at).getTime() < Date.now();
}

/** Cupons válidos para exibição pública no site. */
export function activeCoupons(coupons: Coupon[] | undefined): Coupon[] {
  return (coupons ?? []).filter((c) => c.active && !isExpired(c));
}

/**
 * Encontra o melhor cupom (maior desconto) para um código informado,
 * respeitando restrições de país e produto.
 */
export function matchCoupon(
  coupons: Coupon[] | undefined,
  rawCode: string,
  countryCode: string,
  numberType: string,
): Coupon | null {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const matches = activeCoupons(coupons).filter(
    (c) =>
      c.code.toUpperCase() === code &&
      (!c.country_code || c.country_code === countryCode) &&
      (!c.number_type || c.number_type === numberType),
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, c) => (c.percent > best.percent ? c : best), matches[0]!);
}

export function couponScopeLabel(
  c: Coupon,
  countryName?: (code: string) => string | undefined,
): string {
  const parts: string[] = [];
  if (c.country_code) parts.push(countryName?.(c.country_code) ?? c.country_code);
  if (c.number_type) {
    parts.push(
      c.number_type === "business"
        ? "WhatsApp Business"
        : c.number_type === "whatsapp"
          ? "WhatsApp pessoal"
          : c.number_type,
    );
  }
  return parts.length ? parts.join(" · ") : "Todos os países e chips";
}

