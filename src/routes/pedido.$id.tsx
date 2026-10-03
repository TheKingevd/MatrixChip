import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, MapPin, Package, Truck, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, usePixSettings } from "@/lib/catalog";
import { getOrderServerFn, type PublicOrder } from "@/lib/api.functions";
import { Flag } from "@/components/Flag";
import { toast } from "sonner";

export const Route = createFileRoute("/pedido/$id")({
  component: PedidoAcompanhamentoPage,
});

function PedidoAcompanhamentoPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const id = params.id || "";
  const pix = usePixSettings();
  const [copied, setCopied] = useState(false);

  const { data: order, isLoading } = useQuery<PublicOrder | null>({
    queryKey: ["order", id],
    queryFn: async () => {
      if (!id) return null;
      return await getOrderServerFn({ data: { id } });
    },
    refetchInterval: 10_000,
  });

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

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground bg-background">
        Buscando dados do seu pedido...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center bg-background">
        <Package className="size-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-bold">Pedido não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não localizamos o pedido <strong>{id}</strong>. Verifique o código e tente novamente.
        </p>
        <Button asChild className="mt-6 btn-pop" variant="outline">
          <Link to="/">Voltar para o Matrix Online</Link>
        </Button>
      </div>
    );
  }

  const statusLabel = () => {
    if (order.status === "enviado") return "Chip Físico Enviado pelos Correios";
    if (order.status === "entregue") return "Chip Físico Entregue";
    if (order.status === "separacao" || order.status === "pago") return "Em Preparação / Embalando";
    return "Aguardando Pagamento PIX";
  };

  const statusColor = () => {
    if (order.status === "enviado") return "#38bdf8";
    if (order.status === "entregue") return "#22c55e";
    if (order.status === "separacao" || order.status === "pago") return "#a855f7";
    return "#eab308";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-gradient text-primary-foreground shadow-glow">
              <Zap className="size-4 fill-current" />
            </span>
            <span className="font-display text-lg font-bold">Matrix Online</span>
          </Link>
          <Button asChild size="sm" variant="outline">
            <Link to="/">Loja de Chips</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 space-y-6">
        {/* TOPO DO PEDIDO */}
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="font-mono text-xs text-primary font-bold uppercase tracking-wider">
                Status da Entrega
              </span>
              <h1 className="mt-1 font-display text-2xl font-bold">{order.id}</h1>
              <p className="text-xs text-muted-foreground">
                Realizado em {new Date(order.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="text-right">
              <Badge
                className="text-xs px-3 py-1 font-bold"
                style={{
                  backgroundColor: `${statusColor()}20`,
                  color: statusColor(),
                  borderColor: `${statusColor()}50`,
                }}
              >
                {statusLabel()}
              </Badge>
              <p className="mt-1 font-mono text-lg font-bold text-foreground">
                {formatBRL(Number(order.total))}
              </p>
            </div>
          </div>

          {/* RASTREIO DOS CORREIOS SE HOUVER */}
          {order.tracking_code && (
            <div className="mt-6 rounded-xl border border-sky-500/40 bg-sky-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Truck className="size-6 text-sky-400" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-sky-400">
                      Código de Rastreamento Correios
                    </p>
                    <p className="font-mono text-lg font-bold text-foreground">
                      {order.tracking_code}
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  size="sm"
                  className="btn-pop bg-sky-600 hover:bg-sky-500 text-white"
                >
                  <a
                    href={`https://rastreamento.correios.com.br/app/index.php`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Rastrear nos Correios <ExternalLink className="ml-1.5 size-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* DETALHES DO ITEM E DESTINATÁRIO */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Dados do Destinatário e Endereço */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <MapPin className="size-4 text-primary" /> Endereço de Entrega
            </h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground text-sm">{order.customer_name}</p>
              <p>
                {order.street}, {order.number} {order.complement ? `(${order.complement})` : ""}
              </p>
              <p>
                {order.neighborhood} — {order.city} / {order.state}
              </p>
              <p className="font-mono text-foreground font-bold">CEP: {order.cep}</p>
              <p>WhatsApp: {order.customer_phone}</p>
            </div>
          </div>

          {/* Chip Selecionado */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Package className="size-4 text-primary" /> Produto Escolhido
            </h3>
            <div className="flex items-center gap-3 pt-2">
              <Flag
                code={order.country_code}
                name={order.country_name}
                className="h-8 w-11 rounded"
              />
              <div>
                <p className="font-semibold text-foreground text-sm">
                  Chip Físico {order.country_name} {order.ddd ? `(DDD ${order.ddd})` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Envio Correios com Frete Grátis · {formatBRL(Number(order.unit_price))}
                </p>
              </div>
            </div>

            {order.pix_status !== "confirmado" && (
              <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      Chave PIX ({pix.keyType})
                    </p>
                    <p className="font-mono text-foreground font-bold break-all">{pix.key}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyPix}
                    className="h-7 text-xs shrink-0"
                  >
                    {copied ? (
                      <Check className="size-3 text-primary" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
