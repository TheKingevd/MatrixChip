import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Copy, ExternalLink, LogOut, Package, ShoppingBag, Truck, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { getCustomerOrdersServerFn, refreshCustomerOrderPaymentServerFn } from "@/lib/api.functions";
import { formatBRL, useSupportPhone, whatsAppLink } from "@/lib/catalog";
import { Flag } from "@/components/Flag";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { toast } from "sonner";

export const Route = createFileRoute("/conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta — Matrix Online" },
      { name: "description", content: "Acompanhe seus chips físicos, pagamentos e entregas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomerAccount,
});

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pendente: "Aguardando pagamento",
    pago: "Pagamento confirmado",
    preparando: "Em preparação",
    enviado: "Enviado",
    entregue: "Entregue",
    cancelada: "Cancelado",
    erro_pagamento: "Erro no pagamento",
  };
  return labels[status] || status;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "entregue") return <CheckCircle2 className="size-5 text-primary" />;
  if (status === "cancelada" || status === "erro_pagamento") return <XCircle className="size-5 text-destructive" />;
  if (status === "enviado") return <Truck className="size-5 text-primary" />;
  if (status === "preparando") return <Package className="size-5 text-primary" />;
  return <Clock3 className="size-5 text-amber-400" />;
}

const DELIVERY_STEPS = [{ key: "pago", label: "Pagamento confirmado", icon: CheckCircle2 }, { key: "preparando", label: "Em separação", icon: Package }, { key: "enviado", label: "Enviado", icon: Truck }, { key: "entregue", label: "Entregue", icon: CheckCircle2 }];

function deliveryStepIndex(status: string, paid: boolean) { if (status === "entregue") return 3; if (status === "enviado") return 2; if (status === "preparando") return 1; if (paid || status === "pago") return 0; return -1; }

function CustomerAccount() {
  const { loading, session, user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const supportPhone = useSupportPhone();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["customer-orders"],
    queryFn: () => getCustomerOrdersServerFn(),
    enabled: !!session && user?.role === "customer",
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
    if (!loading && session && user?.role !== "customer") void navigate({ to: "/" });
  }, [loading, session, user, navigate]);

  useEffect(() => {
    if (!session || user?.role !== "customer") return;
    const pending = orders.filter((o: any) => o.pix_status !== "confirmado" && o.payment_external_id);
    if (!pending.length) return;

    let cancelled = false;
    const refresh = async () => {
      for (const order of pending.slice(0, 5)) {
        try {
          if (!cancelled) await refreshCustomerOrderPaymentServerFn({ data: { id: order.id } });
        } catch {
          // O próximo ciclo tenta novamente.
        }
      }
      if (!cancelled) void qc.invalidateQueries({ queryKey: ["customer-orders"] });
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [session, user, orders, qc]);

  if (loading || !session || user?.role !== "customer") {
    return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Carregando sua conta…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-glow">
              <Zap className="size-5 fill-current" />
            </span>
            <div>
              <p className="font-display text-base font-bold sm:text-lg">Matrix Online</p>
              <p className="text-[10px] uppercase tracking-wider text-primary">Minha conta</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut className="mr-1.5 size-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-5 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="font-display text-2xl font-bold sm:text-3xl">Olá, {user.name.split(" ")[0]} 👋</h1><p className="mt-1 text-sm text-muted-foreground">Acompanhe seus pedidos, pagamentos e envios em um só lugar.</p></div>
          <div className="flex flex-wrap gap-2"><Button onClick={() => void navigate({ to: "/" })}><ShoppingBag className="mr-1.5 size-4" /> Comprar outro chip</Button><Button variant="outline" asChild><a href={whatsAppLink("Olá! Preciso de ajuda com meu pedido na Matrix Online.", supportPhone)} target="_blank" rel="noreferrer"><WhatsAppIcon className="mr-1.5 size-5" /> Suporte</a></Button></div>
        </div>
        {orders.length > 0 && <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border/70 bg-card p-4"><p className="text-xs text-muted-foreground">Meus pedidos</p><p className="mt-1 font-display text-2xl font-black">{orders.length}</p></div><div className="rounded-2xl border border-border/70 bg-card p-4"><p className="text-xs text-muted-foreground">Pedidos em envio</p><p className="mt-1 font-display text-2xl font-black">{orders.filter((o: any) => ["preparando", "enviado"].includes(o.status)).length}</p></div><div className="rounded-2xl border border-border/70 bg-card p-4"><p className="text-xs text-muted-foreground">Total em compras</p><p className="mt-1 font-display text-2xl font-black text-primary">{formatBRL(orders.reduce((sum: number, o: any) => sum + Number(o.total), 0))}</p></div></div>}
        <div className="flex items-center gap-2"><ShoppingBag className="size-5 text-primary" /><h2 className="font-display text-xl font-bold">Meus pedidos e envios</h2></div>

        {isLoading ? (
          <div className="rounded-2xl border border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">Carregando pedidos…</div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card p-10 text-center">
            <Package className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 font-display text-xl font-bold">Você ainda não tem pedidos</h2>
            <Button className="mt-5" onClick={() => void navigate({ to: "/" })}>Ver chips</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {orders.map((order: any) => {
              const paid = order.pix_status === "confirmado";
              const currentStep = deliveryStepIndex(order.status, paid);
              return (
                <article key={order.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={order.status} />
                        <span className="font-display text-lg font-bold">{statusLabel(order.status)}</span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{order.id}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-display text-2xl font-black text-primary">{formatBRL(Number(order.total))}</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-border/60 bg-background/30 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Andamento do envio</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{DELIVERY_STEPS.map((step, index) => { const active = index <= currentStep; const StepIcon = step.icon; return <div key={step.key} className={active ? "rounded-xl border border-primary/30 bg-primary/5 p-3" : "rounded-xl border border-border/60 bg-background/30 p-3"}><StepIcon className={active ? "size-5 text-primary" : "size-5 text-muted-foreground"} /><p className={active ? "mt-2 text-xs font-semibold" : "mt-2 text-xs text-muted-foreground"}>{step.label}</p></div>; })}</div></div>

                  <div className="mt-5 grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2 md:grid-cols-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Seu chip</p>
                      <p className="mt-1 font-semibold">Chip Físico {order.country_name}</p>
                      <p className="text-xs text-muted-foreground">{order.dial}{order.ddd ? ` · DDD ${order.ddd}` : ""}</p>
                      {order.assigned_number && <p className="mt-1 font-mono text-xs">{order.assigned_number}</p>}
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pagamento</p>
                      <p className={paid ? "mt-1 font-semibold text-primary" : "mt-1 font-semibold text-amber-400"}>
                        {paid ? "PIX confirmado" : "Aguardando PIX"}
                      </p>
                      {order.payment_provider && <p className="text-xs capitalize text-muted-foreground">{order.payment_provider === "mercadopago" ? "Mercado Pago" : "Asaas"}</p>}
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Entrega</p>
                      <p className="mt-1 font-semibold">{order.tracking_code || "Aguardando código de rastreio"}</p>
                      <p className="text-xs text-muted-foreground">{order.city}/{order.state}</p>
                    </div>
                  </div>

                  {!paid && order.pix_payload && (
                    <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-xs font-semibold text-primary">PIX Copia e Cola</p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <Input value={order.pix_payload} readOnly className="font-mono text-xs" />
                        <Button size="sm" variant="outline" onClick={async () => {
                          await navigator.clipboard.writeText(order.pix_payload);
                          toast.success("PIX copiado!");
                        }}>
                          <Copy className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {order.tracking_code && (
                    <Button variant="outline" size="sm" className="mt-4" asChild>
                      <a href={`https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(order.tracking_code)}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1.5 size-4" /> Rastrear Correios
                      </a>
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
