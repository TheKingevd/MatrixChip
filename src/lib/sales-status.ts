export const SALE_STATUSES = [
  { value: "pendente", label: "Pendente", color: "hsl(45 93% 47%)" },
  { value: "pago", label: "Pago", color: "hsl(217 91% 60%)" },
  { value: "processando", label: "Processando", color: "hsl(271 81% 66%)" },
  { value: "entregue", label: "Entregue", color: "hsl(152 65% 45%)" },
  { value: "cancelada", label: "Cancelada", color: "hsl(0 72% 55%)" },
] as const;

export type SaleStatus = (typeof SALE_STATUSES)[number]["value"];

const LEGACY: Record<string, string> = { cancelado: "cancelada" };

export function normalizeStatus(status: string): string {
  return LEGACY[status] ?? status;
}

export function statusLabel(status: string): string {
  const s = normalizeStatus(status);
  return SALE_STATUSES.find((x) => x.value === s)?.label ?? s;
}

export function statusColor(status: string): string {
  const s = normalizeStatus(status);
  return SALE_STATUSES.find((x) => x.value === s)?.color ?? "hsl(215 16% 55%)";
}

export const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
  transferencia: "Transferência",
};

export function paymentLabel(method: string): string {
  return PAYMENT_LABELS[method] ?? method.toUpperCase();
}

export function productLabel(numberType: string, delivery: string): string {
  const t =
    numberType === "whatsapp"
      ? "WhatsApp pessoal"
      : numberType === "business"
        ? "WhatsApp Business"
        : "Pessoal + Business";
  const d = delivery === "esim" ? "eSIM" : delivery === "chip" ? "Chip físico" : "eSIM + chip";
  return `${t} · ${d}`;
}
