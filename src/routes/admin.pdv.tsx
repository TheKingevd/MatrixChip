import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createOrderServerFn } from "@/lib/api.functions";
import { SALE_STATUSES } from "@/lib/sales-status";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/Flag";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatBRL,
  useCatalog,
  whatsAppLink,
} from "@/lib/catalog";
import { matchCoupon, useCoupons } from "@/lib/coupons";
import { useSellers } from "@/lib/sellers";
import { BRAZIL_DDDS } from "@/data/ddd";

export const Route = createFileRoute("/admin/pdv")({
  component: PdvPage,
});

const saleSchema = z.object({
  country_code: z.string().min(2),
  customer_name: z.string().trim().min(2, "Informe o nome do cliente").max(120),
  customer_phone: z.string().trim().max(30).optional(),
  assigned_number: z.string().trim().max(40).optional(),
  quantity: z.number().int().min(1).max(100),
  unit_price: z.number().min(0).max(1000000),
  discount: z.number().min(0).max(1000000),
  notes: z.string().trim().max(500).optional(),
});

function PdvPage() {
  const { catalog } = useCatalog();
  const qc = useQueryClient();

  const [code, setCode] = useState("BR");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [lastCustomerPhone, setLastCustomerPhone] = useState("");
  const [lastWhatsAppMessage, setLastWhatsAppMessage] = useState("");
  const [ddd, setDdd] = useState("11");
  const [assignedNumber, setAssignedNumber] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [discount, setDiscount] = useState(0);
  const [numberType, setNumberType] = useState("ambos");
  const [delivery, setDelivery] = useState("esim");
  const [payment, setPayment] = useState("pix");
  const [status, setStatus] = useState("pago");
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: coupons } = useCoupons();
  const { data: sellers } = useSellers();

  const selected = useMemo(() => catalog.find((c) => c.code === code), [catalog, code]);
  const price = unitPrice ?? selected?.price ?? 0;
  const coupon = useMemo(
    () => (couponCode.trim() ? matchCoupon(coupons, couponCode, code, numberType) : null),
    [coupons, couponCode, code, numberType],
  );
  const couponDiscount = coupon ? (price * quantity * Number(coupon.percent)) / 100 : 0;
  const totalDiscount = discount + couponDiscount;
  const total = Math.max(0, price * quantity - totalDiscount);

  // O PDV não cria cobrança automática no gateway.
  const buildWhatsAppMessage = () => {
    const typeLabel =
      numberType === "business"
        ? "WhatsApp Business"
        : numberType === "whatsapp"
          ? "WhatsApp pessoal"
          : "WhatsApp pessoal ou Business";
    const lines = [
      `*Pedido — ${selected?.name ?? ""}*`,
      ` `,
      `Produto: ${typeLabel} (${delivery === "esim" ? "eSIM virtual" : "Chip físico"})`,
      ...(selected?.code === "BR" ? [`DDD de preferência: ${ddd}`] : []),
      `Quantidade: ${quantity}`,
      `Valor unitário: ${formatBRL(price)}`,
      ...(discount > 0 ? [`Desconto: -${formatBRL(discount)}`] : []),
      ...(coupon
        ? [`Cupom ${coupon.code} (${Number(coupon.percent)}%): -${formatBRL(couponDiscount)}`]
        : []),
      `*Total: ${formatBRL(total)}*`,
      ` `,
      `*Forma de pagamento: ${payment.toUpperCase()}*`,
      `Esta é uma cobrança enviada pelo atendimento. Nenhuma cobrança automática foi criada.`,
      `Responda por aqui para receber as instruções de pagamento.`,
      ` `,
      `Obrigado!`,
    ];
    return lines.join("\\n");
  };

  // Nunca usamos o número de suporte como fallback: a cobrança deve ir
  // somente para o WhatsApp informado pelo cliente.
  const rawWhatsAppTarget = customerPhone.trim() || lastCustomerPhone.trim();
  const targetDigits = rawWhatsAppTarget.replace(/\D/g, "");
  const whatsAppTarget =
    code === "BR" && (targetDigits.length === 10 || targetDigits.length === 11)
      ? `55${targetDigits}`
      : targetDigits;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const parsed = saleSchema.safeParse({
      country_code: code,
      customer_name: customerName,
      customer_phone: customerPhone,
      assigned_number: assignedNumber,
      quantity,
      unit_price: price,
      discount,
      notes,
    });
    if (!parsed.success || !selected) {
      setMsg({
        ok: false,
        text: parsed.success ? "Selecione um país." : parsed.error.issues[0]!.message,
      });
      return;
    }
    setBusy(true);
    try {
      await createOrderServerFn({
        data: {
          country_code: selected.code,
          country_name: selected.name,
          dial: selected.dial,
          ddd: selected.code === "BR" ? ddd : null,
          assigned_number: parsed.data.assigned_number || null,
          customer_name: parsed.data.customer_name,
          customer_phone: parsed.data.customer_phone || "Não informado",
          customer_cpf: "PDV-BALCAO",
          cep: "00000-000",
          street: "Venda Balcão PDV",
          number: "S/N",
          neighborhood: "Balcão",
          city: "PDV",
          state: "BR",
          number_type: numberType,
          delivery,
          quantity,
          unit_price: price,
          discount: totalDiscount,
          total,
          coupon_code: coupon?.code ?? null,
          coupon_percent: coupon ? Number(coupon.percent) : null,
          payment_method: payment,
          status,
          notes: parsed.data.notes || null,
          seller_id: sellerId || null,
        },
      });
    } catch {
      setBusy(false);
      setMsg({ ok: false, text: "Não foi possível registrar a venda." });
      return;
    }
    setBusy(false);
    void qc.invalidateQueries({ queryKey: ["sales"] });
    setMsg({ ok: true, text: `Venda registrada: ${formatBRL(total)}` });
    if (customerPhone.trim()) {
      setLastCustomerPhone(customerPhone.trim());
      setLastWhatsAppMessage(buildWhatsAppMessage());
    }
    setCustomerName("");
    setCustomerPhone("");
    setAssignedNumber("");
    setQuantity(1);
    setDiscount(0);
    setNotes("");
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">PDV — registrar venda</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Selecione o país, ajuste o valor e registre a venda no caixa.
      </p>

      <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pais">País</Label>
              <select
                id="pais"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setUnitPrice(null);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {catalog.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.dial})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de número</Label>
              <Select value={numberType} onValueChange={setNumberType}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp pessoal</SelectItem>
                  <SelectItem value="business">WhatsApp Business</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cliente">Cliente</Label>
              <Input
                id="cliente"
                value={customerName}
                maxLength={120}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fone">Telefone do cliente</Label>
              <Input
                id="fone"
                value={customerPhone}
                maxLength={30}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+55 45 99122-6904"
              />
            </div>
            {code === "BR" && (
              <div className="space-y-1.5">
                <Label htmlFor="ddd">DDD preferido</Label>
                <select
                  id="ddd"
                  value={ddd}
                  onChange={(e) => setDdd(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {BRAZIL_DDDS.map((d) => (
                    <option key={d.ddd} value={d.ddd}>
                      ({d.ddd}) {d.city} — {d.uf}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="numero">Número entregue</Label>
              <Input
                id="numero"
                value={assignedNumber}
                maxLength={40}
                onChange={(e) => setAssignedNumber(e.target.value)}
                placeholder={`${selected?.dial ?? "+55"} 99999-0000`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entrega">Entrega</Label>
              <Select value={delivery} onValueChange={setDelivery}>
                <SelectTrigger id="entrega">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="esim">eSIM virtual</SelectItem>
                  <SelectItem value="chip">Chip físico real</SelectItem>
                  <SelectItem value="ambos">eSIM + chip</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendedor">Vendedor</Label>
              <select
                id="vendedor"
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sem vendedor</option>
                {(sellers ?? [])
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {Number(s.commission_percent)}%
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pagamento">Pagamento</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger id="pagamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cripto">Cripto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qtd">Quantidade</Label>
              <Input
                id="qtd"
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor unitário (R$)</Label>
              <Input
                id="valor"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desconto">Desconto (R$)</Label>
              <Input
                id="desconto"
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cupom">Cupom</Label>
              <Input
                id="cupom"
                value={couponCode}
                maxLength={30}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Código do cupom"
                className="uppercase"
              />
              {couponCode.trim() && (
                <p className={`text-xs ${coupon ? "text-primary" : "text-destructive"}`}>
                  {coupon
                    ? `Cupom ${coupon.code}: -${Number(coupon.percent)}% (${formatBRL(couponDiscount)})`
                    : "Cupom inválido para este país/produto."}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes da ativação, endereço de envio do chip, etc."
            />
          </div>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-border/70 bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Resumo</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>País</span>
              <span className="flex items-center gap-2 text-foreground">
                {selected && <Flag code={selected.code} name={selected.name} />}
                {selected?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Unitário</span>
              <span className="text-foreground">{formatBRL(price)}</span>
            </div>
            <div className="flex justify-between">
              <span>Quantidade</span>
              <span className="text-foreground">{quantity}</span>
            </div>
            <div className="flex justify-between">
              <span>Desconto</span>
              <span className="text-foreground">-{formatBRL(discount)}</span>
            </div>
            {coupon && (
              <div className="flex justify-between">
                <span>Cupom {coupon.code}</span>
                <span className="text-primary">-{formatBRL(couponDiscount)}</span>
              </div>
            )}
          </div>
          <div className="flex items-end justify-between border-t border-border/60 pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-2xl font-bold">{formatBRL(total)}</span>
          </div>
          {msg && (
            <p className={msg.ok ? "text-sm text-primary" : "text-sm text-destructive"}>
              {msg.text}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Registrando..." : "Registrar venda"}
          </Button>
          <Button asChild variant="outline" className="w-full" disabled={!selected || !whatsAppTarget}>
            <a
              href={whatsAppLink(lastWhatsAppMessage || buildWhatsAppMessage(), whatsAppTarget)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Enviar cobrança no WhatsApp (PIX anexado)
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            A mensagem vai com o resumo do pedido, a chave PIX cadastrada e o link de pagamento.
            {whatsAppTarget
              ? ` Destino: WhatsApp do cliente (${whatsAppTarget}).`
              : " Informe o telefone do cliente para enviar a cobrança."}
          </p>
        </aside>
      </form>
    </div>
  );
}
