import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Copy, ExternalLink, LogOut, Package, Truck, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { getCustomerOrdersServerFn, refreshCustomerOrderPaymentServerFn } from "@/lib/api.functions";
import { formatBRL } from "@/lib/catalog";
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

function CustomerAccount() {
  const { loading, session, user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-glow">
              <Zap className="size-5 fill-current" />
            </span>
            <div>
              <p className="font-display text-lg font-bold">Matrix Online</p>
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

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Olá, {user.name.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">Aqui você acompanha seus chips, pagamentos e entrega.</p>
        </div>

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
              return (
                <article key={order.id} className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
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

                  <div className="mt-5 grid gap-4 border-t border-border/60 pt-5 md:grid-cols-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Seu chip</p>
                      <p className="mt-1 font-semibold">Chip Físico {order.country_name}</p>
                      <p className="text-xs text-muted-foreground">{order.dial}{order.ddd ? \` · DDD \${order.ddd}\` : ""}</p>
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
                      <div className="mt-2 flex gap-2">
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
                      <a href={\`https://rastreamento.correios.com.br/app/index.php?objeto=\${encodeURIComponent(order.tracking_code)}\`} target="_blank" rel="noreferrer">
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
