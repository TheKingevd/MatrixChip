import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Copy,
  CreditCard,
  MapPin,
  Package,
  QrCode,
  ShieldCheck,
  Smartphone,
  Truck,
  Zap,
} from "lucide-react";
import { formatBRL, usePixSettings, useSupportPhone, whatsAppLink } from "@/lib/catalog";
import { useCoupons, matchCoupon } from "@/lib/coupons";
import { createOrderServerFn } from "@/lib/api.functions";
import { toast } from "sonner";
import { Flag } from "./Flag";

export type CheckoutItem = {
  code: string;
  name: string;
  dial: string;
  price: number;
  ddd?: string | undefined;
  type: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CheckoutItem | null;
}

export function PhysicalChipCheckoutModal({ open, onOpenChange, item }: Props) {
  const pix = usePixSettings();
  const supportPhone = useSupportPhone();
  const { data: coupons } = useCoupons();

  // Estados do formulário
  const [step, setStep] = useState<"form" | "pix" | "success">("form");
  const [customerName, setCustomerName] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Endereço
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);

  // Cupom
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; percent: number } | null>(null);

  // Pedido criado
  const [orderResult, setOrderResult] = useState<{ orderId: string; total: number; payment: { provider: "asaas" | "mercadopago"; qrCode: string; qrCodeDataUrl: string; ticketUrl?: string | null; expiresAt?: string | null } } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      // Reset ao fechar
      setTimeout(() => {
        setStep("form");
        setAppliedCoupon(null);
        setCouponCode("");
        setOrderResult(null);
      }, 300);
    }
  }, [open]);

  if (!item) return null;

  // Formatação de CPF
  const handleCpfChange = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 11);
    let formatted = raw;
    if (raw.length > 9) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
    } else if (raw.length > 6) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
    } else if (raw.length > 3) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3)}`;
    }
    setCustomerCpf(formatted);
  };

  // Formatação de Telefone
  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 11);
    let formatted = raw;
    if (raw.length > 6) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    } else if (raw.length > 2) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    }
    setCustomerPhone(formatted);
  };

  // Busca de CEP automática
  const handleCepChange = async (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 8);
    let formatted = raw;
    if (raw.length > 5) {
      formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    }
    setCep(formatted);

    if (raw.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro || "");
          setNeighborhood(data.bairro || "");
          setCity(data.localidade || "");
          setState(data.uf || "");
          toast.success("Endereço preenchido pelo CEP!");
        } else {
          toast.error("CEP não encontrado.");
        }
      } catch {
        // falha silenciosa
      } finally {
        setLoadingCep(false);
      }
    }
  };

  // Aplicação de cupom
  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    const found = matchCoupon(coupons, couponCode, item.code, item.type);
    if (found) {
      setAppliedCoupon({ code: found.code, percent: found.percent });
      toast.success(`Cupom ${found.code} aplicado: ${found.percent}% de desconto!`);
    } else {
      toast.error("Cupom inválido ou expirado.");
    }
  };

  // Cálculos de valor
  const unitPrice = item.price;
  const discountAmount = appliedCoupon ? (unitPrice * appliedCoupon.percent) / 100 : 0;
  const shippingCost = 0; // Frete Grátis Especial Matrix Online
  const total = Math.max(0, unitPrice - discountAmount + shippingCost);

  // Copiar chave PIX
  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(pix.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Chave PIX copiada!");
    } catch {
      setCopied(false);
    }
  };

  // Submeter pedido
  const handleConfirmOrder = async () => {
    if (!customerName.trim() || customerName.trim().length < 3) {
      toast.error("Informe seu nome completo");
      return;
    }
    if (customerCpf.replace(/\D/g, "").length < 11) {
      toast.error("Informe um CPF válido para emissão do envio");
      return;
    }
    if (customerPhone.replace(/\D/g, "").length < 10) {
      toast.error("Informe seu WhatsApp para contato e rastreio");
      return;
    }
    if (cep.replace(/\D/g, "").length < 8) {
      toast.error("Informe o CEP de entrega");
      return;
    }
    if (!street.trim() || !number.trim() || !city.trim() || !state.trim()) {
      toast.error("Preencha o endereço de entrega completo (Rua, Número, Cidade e UF)");
      return;
    }

    setBusy(true);
    try {
      const res = await createOrderServerFn({
        data: {
          country_code: item.code,
          country_name: item.name,
          dial: item.dial,
          ddd: item.ddd || null,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_cpf: customerCpf.trim(),
          customer_email: customerEmail.trim() || undefined,
          cep: cep.trim(),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim() || undefined,
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: state.trim(),
          number_type: item.type,
          delivery: "chip", // CHIP FÍSICO
          quantity: 1,
          unit_price: unitPrice,
          discount: discountAmount,
          shipping_cost: shippingCost,
          total,
          coupon_code: appliedCoupon?.code || null,
          coupon_percent: appliedCoupon?.percent || null,
          payment_method: "pix",
        },
      });

      if (res.ok) {
        setOrderResult({ orderId: res.orderId, total: res.total, payment: res.payment });
        setStep("pix");
        toast.success("Pedido registrado com sucesso!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar pedido.");
    } finally {
      setBusy(false);
    }
  };

  const whatsAppFinishLink = orderResult
    ? whatsAppLink(
        `Olá Matrix Online! Acabei de fazer o pedido ${orderResult.orderId} do Chip Físico (${item.name}${item.ddd ? ` DDD ${item.ddd}` : ""}) no valor de R$ ${orderResult.total.toFixed(2)}. Segue o comprovante de pagamento para envio para: ${street}, ${number} - ${city}/${state}!`,
        supportPhone
      )
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-border/80 bg-card p-6 shadow-2xl sm:rounded-2xl">
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-2 text-primary">
            <Package className="size-5" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
              Matrix Online · Compra de Chip Físico
            </span>
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            {step === "form" && "Endereço e Dados para Envio"}
            {step === "pix" && "Pagamento do Pedido via PIX"}
            {step === "success" && "Pedido Concluído com Sucesso!"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === "form" && "Preencha seus dados para envio expresso do seu chip físico."}
            {step === "pix" && "Efetue o pagamento PIX para liberarmos o despacho nos Correios."}
            {step === "success" && "Seu chip físico já está em fase de preparação."}
          </DialogDescription>
        </DialogHeader>

        {/* ================= PASSO 1: FORMULÁRIO DE COMPRA ================= */}
        {step === "form" && (
          <div className="space-y-6 pt-2">
            {/* Card do Produto Selecionado */}
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <Flag code={item.code} name={item.name} className="h-8 w-11 rounded shadow-sm" />
                <div>
                  <h4 className="font-semibold text-foreground">
                    Chip Físico {item.name} {item.ddd ? `(DDD ${item.ddd})` : ""}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Linha real física · Envio pelos Correios com código de rastreamento
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-lg font-bold text-primary">
                  {formatBRL(unitPrice)}
                </span>
                <Badge variant="outline" className="block text-[10px] text-primary border-primary/40">
                  Frete Grátis
                </Badge>
              </div>
            </div>

            {/* Dados do Destinatário */}
            <div className="space-y-3">
              <h5 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Smartphone className="size-4 text-primary" />
                1. Dados do Destinatário
              </h5>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="nome" className="text-xs">
                    Nome Completo *
                  </Label>
                  <Input
                    id="nome"
                    placeholder="Seu nome completo"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cpf" className="text-xs">
                    CPF (para nota/envio) *
                  </Label>
                  <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={customerCpf}
                    onChange={(e) => handleCpfChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="whats" className="text-xs">
                    WhatsApp para Rastreio *
                  </Label>
                  <Input
                    id="whats"
                    placeholder="(11) 99999-9999"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Endereço de Entrega */}
            <div className="space-y-3 border-t border-border/60 pt-4">
              <h5 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Truck className="size-4 text-primary" />
                2. Endereço de Entrega do Chip Físico
              </h5>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-1">
                  <Label htmlFor="cep" className="text-xs">
                    CEP * {loadingCep && <span className="text-[10px] text-primary">(Buscando...)</span>}
                  </Label>
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="rua" className="text-xs">
                    Rua / Avenida *
                  </Label>
                  <Input
                    id="rua"
                    placeholder="Ex: Av. Paulista"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="numero" className="text-xs">
                    Número *
                  </Label>
                  <Input
                    id="numero"
                    placeholder="123"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="comp" className="text-xs">
                    Complemento
                  </Label>
                  <Input
                    id="comp"
                    placeholder="Apto 42, Bloco B"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bairro" className="text-xs">
                    Bairro *
                  </Label>
                  <Input
                    id="bairro"
                    placeholder="Centro"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cidade" className="text-xs">
                    Cidade *
                  </Label>
                  <Input
                    id="cidade"
                    placeholder="São Paulo"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="uf" className="text-xs">
                    Estado (UF) *
                  </Label>
                  <Input
                    id="uf"
                    maxLength={2}
                    placeholder="SP"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            </div>

            {/* Cupom de Desconto */}
            <div className="rounded-xl border border-border/70 bg-background/50 p-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Tem um cupom? (Ex: MATRIX10)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={handleApplyCoupon}
                >
                  Aplicar
                </Button>
              </div>
              {appliedCoupon && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-primary">
                  <Check className="size-3" /> Desconto de {appliedCoupon.percent}% ativo ({appliedCoupon.code})
                </p>
              )}
            </div>

            {/* Resumo Financeiro */}
            <div className="rounded-xl border border-border/70 bg-card p-4 text-sm">
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Valor do Chip:</span>
                <span>{formatBRL(unitPrice)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between py-1 text-primary">
                  <span>Desconto ({appliedCoupon?.code}):</span>
                  <span>- {formatBRL(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Truck className="size-3.5" /> Envio Expresso Correios:
                </span>
                <span className="font-medium text-primary">GRÁTIS</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border/70 pt-2 text-base font-bold text-foreground">
                <span>Total a Pagar:</span>
                <span className="font-mono text-xl text-primary">{formatBRL(total)}</span>
              </div>
            </div>

            <Button
              className="w-full text-base font-semibold shadow-glow btn-pop"
              size="lg"
              disabled={busy}
              onClick={handleConfirmOrder}
            >
              {busy ? "Processando pedido..." : "Continuar para Pagamento PIX"}
            </Button>
          </div>
        )}

        {/* ================= PASSO 2: PAGAMENTO PIX ================= */}
        {step === "pix" && orderResult && (
          <div className="space-y-6 pt-2">
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 font-mono text-xs font-semibold text-primary">
                PEDIDO: {orderResult.orderId}
              </span>
              <h4 className="mt-2 font-display text-3xl font-extrabold text-foreground">
                {formatBRL(orderResult.total)}
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Pague agora para expedirmos o seu chip físico no próximo lote dos Correios.
              </p>
            </div>

            {/* QR PIX REAL GERADO PELO GATEWAY */}
            <div className="rounded-xl border border-primary/30 bg-background/60 p-5">
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-2xl bg-white p-3 shadow-xl">
                  <img
                    src={orderResult.payment.qrCodeDataUrl}
                    alt="QR Code PIX do pedido"
                    className="size-56 sm:size-64"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    PIX gerado automaticamente
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {orderResult.payment.provider === "asaas" ? "Asaas" : "Mercado Pago"} · Escaneie com o aplicativo do seu banco.
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  PIX Copia e Cola
                </span>
                <div className="mt-2 flex gap-2">
                  <Input value={orderResult.payment.qrCode} readOnly className="font-mono text-xs" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={async () => {
                      await navigator.clipboard.writeText(orderResult.payment.qrCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                      toast.success("PIX Copia e Cola copiado!");
                    }}
                  >
                    {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                    <span className="sr-only sm:not-sr-only sm:ml-1">Copiar</span>
                  </Button>
                </div>
              </div>
              {orderResult.payment.ticketUrl && (
                <Button variant="outline" className="mt-3 w-full" asChild>
                  <a href={orderResult.payment.ticketUrl} target="_blank" rel="noreferrer">
                    Abrir pagamento
                  </a>
                </Button>
              )}
              {orderResult.payment.expiresAt && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  QR Code válido até {new Date(orderResult.payment.expiresAt).toLocaleString("pt-BR")}
                </p>
              )}
            </div>

            {/* Informações de entrega */}
            <div className="rounded-xl border border-border/70 bg-card p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" /> Endereço de envio registrado:
              </p>
              <p>
                {street}, {number} {complement ? `(${complement})` : ""} - {neighborhood}
              </p>
              <p>
                {city} / {state} - CEP: {cep}
              </p>
              <p>Destinatário: {customerName} (CPF: {customerCpf})</p>
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="w-full btn-pop shadow-glow">
                <a href={whatsAppFinishLink} target="_blank" rel="noreferrer">
                  <Check className="mr-2 size-5" /> Já realizei o PIX / Enviar Comprovante
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("success")}
                className="text-xs text-muted-foreground"
              >
                Concluir e ver resumo do pedido
              </Button>
            </div>
          </div>
        )}

        {/* ================= PASSO 3: SUCESSO ================= */}
        {step === "success" && orderResult && (
          <div className="space-y-6 pt-4 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/20 text-primary">
              <Check className="size-8 stroke-[3]" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                Pedido {orderResult.orderId} Registrado!
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Obrigado por comprar no <strong>Matrix Online</strong>. O chip físico já foi reservado
                para o destinatário <strong>{customerName}</strong> e será enviado para o endereço informado.
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-4 text-left text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Próximos passos:</p>
              <p>1. Assim que o pagamento PIX for compensado, o status muda para "Em preparação".</p>
              <p>2. Você receberá o código de rastreamento dos Correios pelo WhatsApp ({customerPhone}).</p>
            </div>

            <Button
              className="w-full btn-pop"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

