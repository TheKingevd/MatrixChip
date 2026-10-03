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
  pix_key: z.string().trim().max(120),
  pix_key_type: z.string().trim().max(30),
  pix_holder: z.string().trim().max(80),
  pix_bank: z.string().trim().max(60),
  payment_link: z.string().trim().max(300),
  pixto_link: z.string().trim().max(300),
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
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("");
  const [pixHolder, setPixHolder] = useState("");
  const [pixBank, setPixBank] = useState("");
  const [payLink, setPayLink] = useState("");
  const [pixToLink, setPixToLink] = useState("");
  const [paymentProvider, setPaymentProvider] = useState<"asaas" | "mercadopago">("asaas");
  const [asaasToken, setAsaasToken] = useState("");
  const [asaasApiUrl, setAsaasApiUrl] = useState("https://api.asaas.com");
  const [asaasWebhookToken, setAsaasWebhookToken] = useState("");
  const [mercadoPagoToken, setMercadoPagoToken] = useState("");
  const [mercadoPagoWebhookSecret, setMercadoPagoWebhookSecret] = useState("");
  const [publicAppUrl, setPublicAppUrl] = useState("");
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
    setPixKey(data["pix_key"] ?? "");
    setPixKeyType(data["pix_key_type"] ?? "");
    setPixHolder(data["pix_holder"] ?? "");
    setPixBank(data["pix_bank"] ?? "");
    setPayLink(data["payment_link"] ?? "");
    setPixToLink(data["pixto_link"] ?? "");
    setPaymentProvider((data["payment_provider"] === "mercadopago" ? "mercadopago" : "asaas"));
    setAsaasToken(data["asaas_access_token"] ?? "");
    setAsaasApiUrl(data["asaas_api_url"] ?? "https://api.asaas.com");
    setAsaasWebhookToken(data["asaas_webhook_token"] ?? "");
    setMercadoPagoToken(data["mercadopago_access_token"] ?? "");
    setMercadoPagoWebhookSecret(data["mercadopago_webhook_secret"] ?? "");
    setPublicAppUrl(data["public_app_url"] ?? "");
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
    asaas_access_token: z.string().max(500),
    asaas_api_url: z.string().max(300),
    asaas_webhook_token: z.string().max(500),
    mercadopago_access_token: z.string().max(500),
    mercadopago_webhook_secret: z.string().max(500),
    public_app_url: z.string().max(300),
  }).safeParse({
      support_phone: phone,
      brand_name: brand,
      hero_note: note,
      ticker_interval: Number(tickerSecs),
      pix_key: pixKey,
      pix_key_type: pixKeyType,
      pix_holder: pixHolder,
      pix_bank: pixBank,
      payment_link: payLink,
      pixto_link: pixToLink,
      payment_provider: paymentProvider,
      asaas_access_token: asaasToken,
      asaas_api_url: asaasApiUrl,
      asaas_webhook_token: asaasWebhookToken,
      mercadopago_access_token: mercadoPagoToken,
      mercadopago_webhook_secret: mercadoPagoWebhookSecret,
      public_app_url: publicAppUrl,
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
      { key: "pix_key", value: parsed.data.pix_key },
      { key: "pix_key_type", value: parsed.data.pix_key_type },
      { key: "pix_holder", value: parsed.data.pix_holder },
      { key: "pix_bank", value: parsed.data.pix_bank },
      { key: "payment_link", value: parsed.data.payment_link },
      { key: "pixto_link", value: parsed.data.pixto_link },
      { key: "payment_provider", value: parsed.data.payment_provider },
      { key: "asaas_access_token", value: parsed.data.asaas_access_token },
      { key: "asaas_api_url", value: parsed.data.asaas_api_url },
      { key: "asaas_webhook_token", value: parsed.data.asaas_webhook_token },
      { key: "mercadopago_access_token", value: parsed.data.mercadopago_access_token },
      { key: "mercadopago_webhook_secret", value: parsed.data.mercadopago_webhook_secret },
      { key: "public_app_url", value: parsed.data.public_app_url },
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
              <select id="payment-provider" value={paymentProvider} onChange={(e) => setPaymentProvider(e.target.value as "asaas" | "mercadopago")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="asaas">Asaas</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="public-url">URL pública do site</Label>
              <Input id="public-url" value={publicAppUrl} onChange={(e) => setPublicAppUrl(e.target.value)} placeholder="https://seudominio.com.br" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asaas-token">Token Asaas</Label>
            <Input id="asaas-token" type="password" value={asaasToken} onChange={(e) => setAsaasToken(e.target.value)} placeholder="Cole o access token do Asaas" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="asaas-url">URL da API Asaas</Label>
              <Input id="asaas-url" value={asaasApiUrl} onChange={(e) => setAsaasApiUrl(e.target.value)} placeholder="https://api.asaas.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asaas-webhook">Token do webhook Asaas</Label>
              <Input id="asaas-webhook" type="password" value={asaasWebhookToken} onChange={(e) => setAsaasWebhookToken(e.target.value)} placeholder="Token configurado no webhook" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp-token">Access Token Mercado Pago</Label>
            <Input id="mp-token" type="password" value={mercadoPagoToken} onChange={(e) => setMercadoPagoToken(e.target.value)} placeholder="Cole o access token do Mercado Pago" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp-webhook">Secret do webhook Mercado Pago</Label>
            <Input id="mp-webhook" type="password" value={mercadoPagoWebhookSecret} onChange={(e) => setMercadoPagoWebhookSecret(e.target.value)} placeholder="Webhook secret / assinatura" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void testGateway()} disabled={testingGateway}>
              {testingGateway ? "Testando..." : `Testar ${paymentProvider === "asaas" ? "Asaas" : "Mercado Pago"}`}
            </Button>
            <span className="self-center text-xs text-muted-foreground">Salve primeiro se acabou de alterar o token.</span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-4">
          <div>
            <Label htmlFor="pix-key">Pagamento via PIX</Label>
            <p className="text-xs text-muted-foreground">
              Informe a chave manualmente. Ela aparece no site para o cliente copiar.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pix-key">Chave PIX</Label>
            <Input
              id="pix-key"
              value={pixKey}
              maxLength={120}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="e-mail, CPF/CNPJ, telefone ou chave aleatória"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pix-type">Tipo da chave</Label>
              <Input
                id="pix-type"
                value={pixKeyType}
                maxLength={30}
                onChange={(e) => setPixKeyType(e.target.value)}
                placeholder="CPF, e-mail, telefone..."
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pix-holder">Nome do titular</Label>
              <Input
                id="pix-holder"
                value={pixHolder}
                maxLength={80}
                onChange={(e) => setPixHolder(e.target.value)}
                placeholder="Nome que aparece no comprovante"
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pix-bank">Banco / instituição</Label>
            <Input
              id="pix-bank"
              value={pixBank}
              maxLength={60}
              onChange={(e) => setPixBank(e.target.value)}
              placeholder="Ex.: Nubank"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-link">Link de pagamento (opcional)</Label>
            <Input
              id="pay-link"
              value={payLink}
              maxLength={300}
              onChange={(e) => setPayLink(e.target.value)}
              placeholder="https://..."
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Anexado à mensagem de WhatsApp montada no PDV, junto com a chave PIX.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pixto-link">Link de cobrança Pix.to (opcional)</Label>
            <Input
              id="pixto-link"
              value={pixToLink}
              maxLength={300}
              onChange={(e) => setPixToLink(e.target.value)}
              placeholder="https://pix.to/sua-cobranca"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Quando preenchido, o site mostra o botão "Pagar agora com Pix.to". Depois que o
              cliente pagar, envie ou anexe o comprovante em Envios PIX para confirmar.
            </p>
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

