import { useQuery } from "@tanstack/react-query";
import {
  getMyPayoutsServerFn,
  getMySalesServerFn,
  getMySellerServerFn,
  getSellerPayoutsServerFn,
  getSalesServerFn,
  getSellersServerFn,
} from "@/lib/api.functions";

export type Seller = {
  id: string;
  name: string;
  commission_percent: number;
  active: boolean;
  created_at: string;
  email?: string | null;
  user_id?: string | null;
};

export type SellerPayout = {
  id: string;
  seller_id: string;
  amount: number;
  note: string | null;
  paid_at: string;
};

export type SellerSale = {
  id: string;
  country_name: string;
  customer_name: string;
  total: number;
  status: string;
  seller_id: string | null;
  created_at: string;
};

// ---------- Painel administrativo (todos os vendedores) ----------

export function useSellers() {
  return useQuery({
    queryKey: ["sellers"],
    queryFn: async () => {
      const data = await getSellersServerFn();
      return (data ?? []) as Seller[];
    },
    staleTime: 60_000,
  });
}

export function usePayouts() {
  return useQuery({
    queryKey: ["seller_payouts"],
    queryFn: async () => {
      const data = await getSellerPayoutsServerFn();
      return (data ?? []) as SellerPayout[];
    },
    staleTime: 30_000,
  });
}

export function useSellerSales() {
  return useQuery({
    queryKey: ["sales", "seller-portal"],
    queryFn: async () => {
      const data = await getSalesServerFn();
      return (data ?? []) as SellerSale[];
    },
    staleTime: 30_000,
  });
}

// ---------- Portal do vendedor (apenas os próprios dados) ----------
// O servidor filtra pelo vendedor da sessão; o navegador não escolhe o que ver.

export function useMySeller() {
  return useQuery({
    queryKey: ["my-seller"],
    queryFn: async () => {
      const data = await getMySellerServerFn();
      return (data ?? null) as { id: string; name: string; commission_percent: number } | null;
    },
    staleTime: 60_000,
  });
}

export function useMySales() {
  return useQuery({
    queryKey: ["my-sales"],
    queryFn: async () => {
      const data = await getMySalesServerFn();
      return (data ?? []) as SellerSale[];
    },
    staleTime: 30_000,
  });
}

export function useMyPayouts() {
  return useQuery({
    queryKey: ["my-payouts"],
    queryFn: async () => {
      const data = await getMyPayoutsServerFn();
      return (data ?? []) as SellerPayout[];
    },
    staleTime: 30_000,
  });
}

export function commissionOf(revenue: number, percent: number) {
  return (revenue * (Number(percent) || 0)) / 100;
}
