import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Trash2 } from "lucide-react";
import { createSellerPayoutServerFn, deleteSellerPayoutServerFn } from "@/lib/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/catalog";
import { commissionOf, usePayouts, useSellerSales, useSellers } from "@/lib/sellers";
import { removeSellerLogin, upsertSellerLogin } from "@/lib/sellers.functions";

export const Route = createFileRoute("/admin/vendedores")({
  component: VendedoresPage,
});

function VendedoresPage() {
  const { data: sellers, isLoading } = useSellers();
  const { data: sales } = useSellerSales();
  const { data: payouts } = usePayouts();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const totals = useMemo(() => {
    const revenue = new Map<string, { count: number; revenue: number }>();
    for (const s of sales ?? []) {
      if (s.status === "cancelada" || !s.seller_id) continue;
      const cur = revenue.get(s.seller_id) ?? { count: 0, revenue: 0 };
      revenue.set(s.seller_id, {
        count: cur.count + 1,
        revenue: cur.revenue + (Number(s.total) || 0),
      });
    }
    const paid = new Map<string, number>();
    for (const p of payouts ?? []) {
      paid.set(p.seller_id, (paid.get(p.seller_id) ?? 0) + (Number(p.amount) || 0));
    }
    return { revenue, paid };
  }, [sales, payouts]);

  const current = (sellers ?? []).find((s) => s.id === selected) ?? null;

  const addPayout = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Escolha um vendedor.");
      const value = Number(amount.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) throw new Error("Informe um valor válido.");
      await createSellerPayoutServerFn({
        data: { seller_id: selected, amount: value, note: note.trim() || null },
      });
    },
    onSuccess: () => {
      toast.success("Pagamento registrado");
      setAmount("");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["seller_payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePayout = useMutation({
    mutationFn: async (id: string) => {
      await deleteSellerPayoutServerFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Pagamento removido");
      void qc.invalidateQueries({ queryKey: ["seller_payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveLogin = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Escolha um vendedor.");
      if (loginPass.length < 6) throw new Error("A senha precisa ter ao menos 6 caracteres.");
      await upsertSellerLogin({
        data: { sellerId: selected, email: loginEmail.trim(), password: loginPass },
      });
    },
    onSuccess: () => {
      toast.success("Acesso do vendedor salvo");
      setLoginPass("");
      void qc.invalidateQueries({ queryKey: ["sellers"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível salvar o acesso."),
  });

  const dropLogin = useMutation({
    mutationFn: async (sellerId: string) => {
      await removeSellerLogin({ data: { sellerId } });
    },
    onSuccess: () => {
      toast.success("Acesso removido");
      setLoginEmail("");
      void qc.invalidateQueries({ queryKey: ["sellers"] });
    },
    onError: () => toast.error("Não foi possível remover o acesso."),
  });

  const selectSeller = (id: string) => {
    setSelected(id);
    const s = (sellers ?? []).find((x) => x.id === id);
    setLoginEmail(s?.email ?? "");
    setLoginPass("");
  };

  const sellerPayouts = (payouts ?? []).filter((p) => !selected || p.seller_id === selected);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Vendedores</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Saldo de comissões, histórico de pagamentos e acesso próprio de cada vendedor.
      </p>

      <div className="neon-card heartbeat-glow mt-6 overflow-x-auto rounded-2xl border border-border/70 bg-card p-2">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Vendedor</th>
              <th className="px-3 py-2">Comissão</th>
              <th className="px-3 py-2">Vendas</th>
              <th className="px-3 py-2">Comissão gerada</th>
              <th className="px-3 py-2">Já recebeu</th>
              <th className="px-3 py-2">Saldo</th>
              <th className="px-3 py-2">Acesso</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : (sellers ?? []).length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-muted-foreground">
                  Cadastre vendedores na aba Comissões.
                </td>
              </tr>
            ) : (
              (sellers ?? []).map((s) => {
                const st = totals.revenue.get(s.id) ?? { count: 0, revenue: 0 };
                const generated = commissionOf(st.revenue, s.commission_percent);
                const paid = totals.paid.get(s.id) ?? 0;
                return (
                  <tr
                    key={s.id}
                    className={
                      "cursor-pointer border-t border-border/60 " +
                      (selected === s.id ? "bg-secondary/40" : "")
                    }
                    onClick={() => selectSeller(s.id)}
                  >
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2">{Number(s.commission_percent)}%</td>
                    <td className="px-3 py-2">{st.count}</td>
                    <td className="px-3 py-2">{formatBRL(generated)}</td>
                    <td className="px-3 py-2">{formatBRL(paid)}</td>
                    <td className="px-3 py-2 font-semibold text-primary">
                      {formatBRL(generated - paid)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.email ? s.email : "sem login"}
                    </td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="ghost" onClick={() => selectSeller(s.id)}>
                        Gerenciar
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addPayout.mutate();
          }}
          className="neon-card heartbeat-glow space-y-4 rounded-2xl border border-border/70 bg-card p-6"
        >
          <h2 className="font-display text-lg font-semibold">
            Registrar pagamento{current ? ` — ${current.name}` : ""}
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="pg-vendedor">Vendedor</Label>
            <select
              id="pg-vendedor"
              value={selected}
              onChange={(e) => selectSeller(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione…</option>
              {(sellers ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pg-valor">Valor pago (R$)</Label>
              <Input
                id="pg-valor"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pg-obs">Observação</Label>
              <Input
                id="pg-obs"
                value={note}
                maxLength={140}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: PIX quinzena"
              />
            </div>
          </div>
          <Button type="submit" className="btn-pop" disabled={addPayout.isPending}>
            {addPayout.isPending ? "Salvando…" : "Registrar pagamento"}
          </Button>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveLogin.mutate();
          }}
          className="neon-card heartbeat-glow space-y-4 rounded-2xl border border-border/70 bg-card p-6"
        >
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <KeyRound className="size-4 text-primary" />
            Acesso do vendedor{current ? ` — ${current.name}` : ""}
          </h2>
          <p className="text-xs text-muted-foreground">
            Escolha um vendedor na tabela, defina e-mail e senha. Ele entra em /vendedor e vê
            apenas as próprias vendas e comissões.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="lg-email">E-mail de acesso</Label>
            <Input
              id="lg-email"
              type="email"
              value={loginEmail}
              maxLength={255}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="vendedor@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lg-senha">Senha</Label>
            <Input
              id="lg-senha"
              type="text"
              value={loginPass}
              maxLength={72}
              onChange={(e) => setLoginPass(e.target.value)}
              placeholder="mínimo 6 caracteres"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="btn-pop" disabled={saveLogin.isPending || !selected}>
              {saveLogin.isPending ? "Salvando…" : "Salvar acesso"}
            </Button>
            {current?.user_id ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => dropLogin.mutate(current.id)}
                disabled={dropLogin.isPending}
              >
                Remover acesso
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="neon-card heartbeat-glow mt-6 overflow-x-auto rounded-2xl border border-border/70 bg-card p-2">
        <h2 className="px-3 pt-3 font-display text-lg font-semibold">
          Histórico de comissões pagas{current ? ` — ${current.name}` : ""}
        </h2>
        <table className="mt-2 w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Vendedor</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Observação</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sellerPayouts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  Nenhum pagamento registrado ainda.
                </td>
              </tr>
            ) : (
              sellerPayouts.map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="px-3 py-2">
                    {new Date(p.paid_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2">
                    {(sellers ?? []).find((s) => s.id === p.seller_id)?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-medium">{formatBRL(Number(p.amount) || 0)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.note ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => removePayout.mutate(p.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

