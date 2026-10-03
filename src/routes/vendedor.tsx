import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, UserRound, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/lib/catalog";
import { commissionOf, useMyPayouts, useMySales, useMySeller } from "@/lib/sellers";
import { loginServerFn } from "@/lib/auth.functions";

export const Route = createFileRoute("/vendedor")({
  head: () => ({
    meta: [
      { title: "Área do Vendedor — Matrix Online" },
      {
        name: "description",
        content:
          "Vendedores acompanham suas vendas de chips físicos, comissões e pagamentos recebidos.",
      },
      { property: "og:title", content: "Área do Vendedor — Matrix Online" },
      { property: "robots", content: "noindex" },
    ],
  }),
  component: SellerPortal,
});

function SellerPortal() {
  const { session, user, loading, signOut } = useAuth();
  const { data: seller, isLoading: loadingSeller } = useMySeller();
  const { data: sales } = useMySales();
  const { data: payouts } = useMyPayouts();

  const totals = useMemo(() => {
    const mine = (sales ?? []).filter((s) => s.status !== "cancelada");
    const revenue = mine.reduce((a, s) => a + (Number(s.total) || 0), 0);
    const generated = commissionOf(revenue, Number(seller?.commission_percent ?? 0));
    const paid = (payouts ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
    return { count: mine.length, revenue, generated, paid, balance: generated - paid };
  }, [sales, payouts, seller]);

  if (loading || (session && loadingSeller)) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground bg-background">
        Carregando painel do vendedor…
      </div>
    );
  }

  if (!session) {
    return <SellerLogin />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-glow">
              <Zap className="size-5 fill-current" />
            </span>
            <div>
              <span className="font-display text-lg font-bold">Matrix Online</span>
              <p className="text-xs text-muted-foreground">Portal do Vendedor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {seller?.name ?? user?.name ?? user?.email}
            </span>
            <Button size="sm" variant="outline" onClick={() => void signOut()}>
              <LogOut className="mr-2 size-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold">Olá, {seller?.name ?? "Vendedor"}!</h1>
          <p className="text-sm text-muted-foreground">
            Sua comissão atual é de{" "}
            <strong className="text-primary">{seller?.commission_percent ?? 0}%</strong> sobre cada
            venda de chip físico.
          </p>
        </div>

        {/* CARDS */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi title="Vendas realizadas" value={String(totals.count)} sub="chips vendidos" />
          <Kpi
            title="Faturamento gerado"
            value={formatBRL(totals.revenue)}
            sub="total das vendas"
          />
          <Kpi title="Comissões geradas" value={formatBRL(totals.generated)} sub="crédito total" />
          <Kpi
            title="Saldo a receber"
            value={formatBRL(totals.balance)}
            sub={`${formatBRL(totals.paid)} já pagos`}
            highlight
          />
        </div>

        {/* TABELAS */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Histórico de Vendas */}
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h3 className="font-display text-base font-bold">Suas Vendas Recentes</h3>
            <div className="mt-4 divide-y divide-border/60">
              {(sales ?? []).map((s) => (
                <div key={s.id} className="py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-medium text-foreground">{s.customer_name}</p>
                    <p className="text-muted-foreground">
                      Chip {s.country_name} · {new Date(s.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{formatBRL(Number(s.total))}</p>
                    <p className="text-primary font-medium">
                      +
                      {formatBRL(
                        commissionOf(Number(s.total), Number(seller?.commission_percent ?? 0)),
                      )}
                    </p>
                  </div>
                </div>
              ))}
              {(sales ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  Nenhuma venda registrada ainda.
                </p>
              )}
            </div>
          </div>

          {/* Pagamentos Recebidos */}
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h3 className="font-display text-base font-bold">Pagamentos de Comissões</h3>
            <div className="mt-4 divide-y divide-border/60">
              {(payouts ?? []).map((p) => (
                <div key={p.id} className="py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-medium text-foreground">Repasse recebido</p>
                    <p className="text-muted-foreground">
                      {new Date(p.paid_at).toLocaleDateString("pt-BR")}{" "}
                      {p.note ? `· ${p.note}` : ""}
                    </p>
                  </div>
                  <p className="font-bold text-primary">{formatBRL(Number(p.amount))}</p>
                </div>
              ))}
              {(payouts ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  Nenhum pagamento registrado ainda.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Kpi({
  title,
  value,
  sub,
  highlight,
}: {
  title: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p
        className={`mt-2 font-display text-2xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function SellerLogin() {
  const { setAuthData } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await loginServerFn({
        data: {
          email: email.trim(),
          password,
        },
      });
      setAuthData(res.user);
      // Recarrega os dados agora que a sessão existe.
      void qc.invalidateQueries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "E-mail ou senha inválidos.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hero-bg flex min-h-screen items-center justify-center px-5 bg-background">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border/70 bg-card p-8 shadow-card"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-glow">
          <UserRound className="size-5" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold">Área do Vendedor</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Matrix Online — Acesse para acompanhar suas comissões.
        </p>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="v-email">E-mail</Label>
            <Input
              id="v-email"
              type="email"
              required
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vendedor@matrixonline.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-pass">Senha</Label>
            <Input
              id="v-pass"
              type="password"
              required
              maxLength={100}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full btn-pop shadow-glow" disabled={busy}>
            {busy ? "Entrando..." : "Entrar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
