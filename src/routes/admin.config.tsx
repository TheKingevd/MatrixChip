import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { getAdminSettingsServerFn, testPaymentGatewayServerFn, updateSettingsServerFn } from "@/lib/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/config")({
  component: ConfigPage,
});

const schema = z.object({
  support_phone: z
    .string()
    .trim()
    .min(8, "Informe o número com DDI, ex: +5545991226904")
    .max(20)
    .regex(/^\+?[0-9\s()-]+$/, "Use apenas números, espaços e o sinal +"),
  brand_name: z.string().trim().min(2).max(60),
  hero_note: z.string().trim().max(160),
  ticker_interval: z
    .number({ message: "Informe um número" })
    .int("Use segundos inteiros")
    .min(3, "Mínimo de 3 segundos")
    .max(600, "Máximo de 600 segundos"),
});

function ConfigPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin_settings"],
    queryFn: () => getAdminSettingsServerFn(),
  });
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [brand, setBrand] = useState("");
  const [note, setNote] = useState("");
  const [tickerOn, setTickerOn] = useState(true);
  const [tickerSecs, setTickerSecs] = useState("15");
  const [paymentProvider, setPaymentProvider] = useState<"asaas" | "mercadopago">("asaas");
  const [gatewayToken, setGatewayToken] = useState("");
  const [paymentMinimum, setPaymentMinimum] = useState("1");
  const [testingGateway, setTestingGateway] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPhone(data["support_phone"] ?? "");
    setBrand(data["brand_name"] ?? "Números Internacionais Global");
    setNote(data["hero_note"] ?? "");
    setTickerOn((data["ticker_enabled"] ?? "on") !== "off");
    setTickerSecs(data["ticker_interval"] ?? "15");
    setPaymentProvider((data["payment_provider"] === "mercadopago" ? "mercadopago" : "asaas"));
    setGatewayToken("");
    setPaymentMinimum(data["payment_minimum"] ?? "1");
  }, [data]);

  const testGateway = async () => {
    setTestingGateway(true);
    try {
      await testPaymentGatewayServerFn({ data: { provider: paymentProvider } });
      setMsg({ ok: true, text: `${paymentProvider === "asaas" ? "Asaas" : "Mercado Pago"} respondeu corretamente. Token válido.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Não foi possível testar o gateway." });
    } finally {
      setTestingGateway(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const parsed = schema.extend({
    payment_provider: z.enum(["asaas", "mercadopago"]),
    gateway_token: z.string().max(1000),
    payment_minimum: z.number().min(0.01).max(1000000),
  }).safeParse({
      support_phone: phone,
      brand_name: brand,
      hero_note: note,
      ticker_interval: Number(tickerSecs),
      payment_provider: paymentProvider,
      gateway_token: gatewayToken,
      payment_minimum: Number(paymentMinimum),
    });
    if (!parsed.success) {
      setMsg({ ok: false, text: parsed.error.issues[0]!.message });
      return;
    }
    setBusy(true);
    const rows = [
      { key: "support_phone", value: parsed.data.support_phone.replace(/\D/g, "") },
      { key: "brand_name", value: parsed.data.brand_name },
      { key: "hero_note", value: parsed.data.hero_note },
      { key: "ticker_enabled", value: tickerOn ? "on" : "off" },
      { key: "ticker_interval", value: String(parsed.data.ticker_interval) },
      { key: "payment_provider", value: parsed.data.payment_provider },
      { key: "payment_minimum", value: String(parsed.data.payment_minimum) },
      ...(parsed.data.gateway_token ? [{ key: parsed.data.payment_provider === "asaas" ? "asaas_access_token" : "mercadopago_access_token", value: parsed.data.gateway_token }] : []),
    ];
    try {
      await updateSettingsServerFn({ data: rows });
    } catch {
      setBusy(false);
      setMsg({ ok: false, text: "Não foi possível salvar as configurações." });
      return;
    }
    setBusy(false);
    void qc.invalidateQueries({ queryKey: ["app_settings"] });
    setMsg({ ok: true, text: "Configurações salvas no Matrix Online." });
  };

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl font-bold">Configurações</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Altere o número de contato usado em todos os botões de WhatsApp do site — sem mexer no
        código.
      </p>

      <form onSubmit={save} className="mt-6 space-y-5 rounded-2xl border border-border/70 bg-card p-6">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Número de contato (WhatsApp)</Label>
          <Input
            id="phone"
            value={phone}
            maxLength={20}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+5545991226904"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Formato internacional com DDI. Ex.: +55 45 99122-6904
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand">Nome da marca</Label>
          <Input
            id="brand"
            value={brand}
            maxLength={60}
            onChange={(e) => setBrand(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">Aviso no topo do site</Label>
          <Input
            id="note"
            value={note}
            maxLength={160}
            onChange={(e) => setNote(e.target.value)}
            placeholder="eSIM virtual · chip físico real · +190 países"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="ticker-on">Balões de compras</Label>
              <p className="text-xs text-muted-foreground">
                Notificações de clientes comprando chip no site
              </p>
            </div>
            <Button
              id="ticker-on"
              type="button"
              variant={tickerOn ? "default" : "outline"}
              size="sm"
              onClick={() => setTickerOn((v) => !v)}
              disabled={isLoading}
            >
              {tickerOn ? "Ativado · pausar" : "Pausado · retomar"}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticker-secs">Frequência dos balões (segundos)</Label>
            <Input
              id="ticker-secs"
              type="number"
              min={3}
              max={600}
              step={1}
              value={tickerSecs}
              onChange={(e) => setTickerSecs(e.target.value)}
              disabled={isLoading || !tickerOn}
            />
            <p className="text-xs text-muted-foreground">
              Ex.: 15 = um balão a cada 15 segundos (mínimo 3, máximo 600)
            </p>
          </div>
        </div>
        <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div>
            <Label>Gateway de pagamento PIX</Label>
            <p className="text-xs text-muted-foreground">
              Essas credenciais ficam no servidor e não são expostas para visitantes. Você pode testar o token antes de usar o checkout.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payment-provider">Gateway ativo</Label>
              <select id="payment-provider" value={paymentProvider} onChange={(e) => {
                const next = e.target.value as "asaas" | "mercadopago";
                setPaymentProvider(next);
                setGatewayToken("");
              }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="asaas">Asaas</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-minimum">Valor mínimo</Label>
              <Input id="payment-minimum" type="number" min="0.01" step="0.01" value={paymentMinimum} onChange={(e) => setPaymentMinimum(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gateway-token">Token do gateway</Label>
            <Input id="gateway-token" type="password" value={gatewayToken} onChange={(e) => setGatewayToken(e.target.value)} placeholder={paymentProvider === "asaas" ? "Access Token do Asaas" : "Access Token do Mercado Pago"} />
            <p className="text-xs text-muted-foreground">O token nunca é devolvido ao navegador. Deixe em branco para manter o token já configurado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void testGateway()} disabled={testingGateway}>
              {testingGateway ? "Testando..." : `Testar ${paymentProvider === "asaas" ? "Asaas" : "Mercado Pago"}`}
            </Button>
            <span className="self-center text-xs text-muted-foreground">Salve primeiro se acabou de alterar o token.</span>
          </div>
        </div>

        {msg && (
          <p className={msg.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{msg.text}</p>
        )}
        <Button type="submit" disabled={busy || isLoading}>
          {busy ? "Salvando..." : "Salvar configurações"}
        </Button>
      </form>
    </div>
  );
}

