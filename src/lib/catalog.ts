import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSettingsServerFn, getCountryOverridesServerFn } from "@/lib/api.functions";
import {
  countries,
  DEFAULT_SUPPORT_PHONE,
  type CountryOffer,
  type NumberType,
} from "@/data/countries";

export type CountryOverride = {
  code: string;
  price: number | null;
  stock: number | null;
  type: string | null;
  esim: boolean | null;
  chip: boolean | null;
  active: boolean;
};

/** Evita divergência entre o HTML do servidor e o cache salvo no navegador. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function useSettings() {
  const hydrated = useHydrated();
  const query = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const data = await getSettingsServerFn();
      return data ?? {};
    },
    staleTime: 5 * 60_000,
    gcTime: 7 * 24 * 60 * 60_000,
  });
  return { ...query, data: hydrated ? query.data : undefined };
}

export function useSupportPhone() {
  const { data } = useSettings();
  return data?.["support_phone"] ?? DEFAULT_SUPPORT_PHONE;
}

export function useTickerSettings() {
  const { data } = useSettings();
  const seconds = Number(data?.["ticker_interval"] ?? 15);
  return {
    enabled: (data?.["ticker_enabled"] ?? "on") !== "off",
    intervalMs: (Number.isFinite(seconds) && seconds >= 3 ? seconds : 15) * 1000,
  };
}

export function usePixSettings() {
  const { data } = useSettings();
  return {
    key: data?.["pix_key"] ?? "matrix@pix.com.br",
    keyType: data?.["pix_key_type"] ?? "E-mail",
    holder: data?.["pix_holder"] ?? "Matrix Online Telecom",
    bank: data?.["pix_bank"] ?? "Banco Inter",
    paymentLink: data?.["payment_link"] ?? "",
    pixToLink: data?.["pixto_link"] ?? "",
  };
}

export function useOverrides() {
  const hydrated = useHydrated();
  const query = useQuery({
    queryKey: ["country_overrides"],
    queryFn: async () => {
      const data = await getCountryOverridesServerFn();
      return (data ?? {}) as Record<string, CountryOverride>;
    },
    staleTime: 5 * 60_000,
    gcTime: 7 * 24 * 60 * 60_000,
  });
  return { ...query, data: hydrated ? query.data : undefined };
}

export function mergeCatalog(
  overrides: Record<string, CountryOverride> | undefined,
): (CountryOffer & { active: boolean })[] {
  return countries.map((c) => {
    const o = overrides?.[c.code];
    return {
      ...c,
      price: o?.price != null ? Number(o.price) : c.price,
      stock: o?.stock != null ? o.stock : c.stock,
      type: (o?.type as NumberType | undefined) ?? c.type,
      esim: o?.esim ?? c.esim,
      chip: o?.chip ?? c.chip,
      active: o?.active ?? true,
    };
  });
}

export function useCatalog() {
  const { data: overrides, isLoading } = useOverrides();
  return { catalog: mergeCatalog(overrides), isLoading };
}

export function whatsAppLink(message: string, phone: string) {
  const number = phone.replace(/\D/g, "");
  const params = new URLSearchParams({ phone: number, text: message });
  return `https://api.whatsapp.com/send?${params.toString()}`;
}

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

