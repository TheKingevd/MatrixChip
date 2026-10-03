import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, WalletCards } from "lucide-react";
import {
  saveSellerServerFn,
  deleteSellerServerFn,
  createSellerPayoutServerFn,
} from "@/lib/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/catalog";
import { usePayouts, useSellers, type Seller } from "@/lib/sellers";

export const Route = createFileRoute("/admin/comissoes")({
  component: ComissoesPage,
});

const EMPTY = { name: "", commission_percent: "10", active: true };

function ComissoesPage() {
  const { data: sellers, isLoading } = useSellers();
  const { data: payouts } = usePayouts();
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [payoutSellerId, setPayoutSellerId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const set = (k: keyof typeof EMPTY, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const selectedPayoutSeller = (sellers ?? []).find((s) => s.id === payoutSellerId);
  const payout = useMutation({
    mutationFn: async () => {
      const amount = Number(payoutAmount.replace(",", "."));
      if (!payoutSellerId) throw new Error("Selecione o vendedor.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Informe um valor de saque válido.");
      if (selectedPayoutSeller && amount > Number(selectedPayoutSeller.balance) + 0.0001) {
        throw new Error("O valor não pode ser maior que o saldo disponível.");
      }

      return createSellerPayoutServerFn({
        data: {
          seller_id: payoutSellerId,
          amount,
          note: payoutNote.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Pagamento de comissão registrado.");
      setPayoutAmount("");
      setPayoutNote("");
      void qc.invalidateQueries({ queryKey: ["sellers"] });
      void qc.invalidateQueries({ queryKey: ["seller_payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const commission_percent = Number(form.commission_percent) || 0;
      if (name.length < 2) throw new Error("Informe o nome do vendedor");
      if (commission_percent < 0 || commission_percent > 100)
        throw new Error("A comissão deve ser entre 0% e 100%");

      await saveSellerServerFn({
        data: {
          id: editingId || undefined,
          name,
          commission_percent,
          active: form.active,
        },
      });
    },
    onSuccess: () => {
      toast.success(editingId ? "Vendedor atualizado" : "Vendedor criado");
      setEditingId(null);
      setForm(EMPTY);
      void qc.invalidateQueries({ queryKey: ["sellers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteSellerServerFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Vendedor removido");
      void qc.invalidateQueries({ queryKey: ["sellers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const edit = (s: Seller) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      commission_percent: String(s.commission_percent),
      active: s.active,
    });
  };

  const totalCommission = (sellers ?? []).reduce(
    (acc, s) => acc + Number(s.earned || 0),
    0,
  );
  const totalPaid = (sellers ?? []).reduce((acc, s) => acc + Number(s.paid || 0), 0);
  const totalBalance = (sellers ?? []).reduce((acc, s) => acc + Number(s.balance || 0), 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Comissões</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Defina a porcentagem de cada vendedor e acompanhe o total vendido por pessoa.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="neon-card heartbeat-glow space-y-4 rounded-2xl border border-border/70 bg-card p-6"
        >
          <h2 className="font-display text-lg font-semibold">
            {editingId ? "Editar vendedor" : "Novo vendedor"}
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Ana Paula"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pct">Comissão (%)</Label>
            <Input
              id="pct"
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={form.commission_percent}
              onChange={(e) => set("commission_percent", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="size-4 accent-primary"
            />
            Vendedor ativo
          </label>
          <div className="flex gap-2">
            <Button type="submit" className="btn-pop" disabled={save.isPending}>
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY);
                }}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>

        <div className="neon-card heartbeat-glow overflow-x-auto rounded-2xl border border-border/70 bg-card p-2">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Vendedor</th>
                <th className="px-3 py-2">Comissão</th>
                <th className="px-3 py-2">Vendas</th>
                <th className="px-3 py-2">Total vendido</th>
                <th className="px-3 py-2">A receber</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : (sellers ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                    Nenhum vendedor cadastrado ainda.
                  </td>
                </tr>
              ) : (
                (sellers ?? []).map((s) => {
                  return (
                    <tr key={s.id} className="border-t border-border/60">
                      <td className="px-3 py-2 font-medium">
                        {s.name}
                        {!s.active ? (
                          <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                            inativo
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{Number(s.commission_percent)}%</td>
                      <td className="px-3 py-2">{Number(s.count || 0)}</td>
                      <td className="px-3 py-2">{formatBRL(Number(s.revenue || 0))}</td>
                      <td className="px-3 py-2 font-semibold text-primary">
                        {formatBRL(Number(s.balance || 0))}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => edit(s)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => remove.mutate(s.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              
            </tbody>
            <tfoot>
              <tr className="border-t border-border/60 font-semibold">
                <td className="px-3 py-2" colSpan={4}>
                  Comissões geradas
                </td>
                <td className="px-3 py-2 text-primary">{formatBRL(totalCommission)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              payout.mutate();
            }}
            className="rounded-2xl border border-border/70 bg-card p-6"
          >
            <div className="flex items-center gap-2">
              <WalletCards className="size-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Registrar saque</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Registre somente o valor que você realmente enviou ao vendedor. O servidor bloqueia valores acima do saldo.
            </p>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="payout-seller">Vendedor</Label>
                <select
                  id="payout-seller"
                  value={payoutSellerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPayoutSellerId(id);
                    const seller = (sellers ?? []).find((item) => item.id === id);
                    setPayoutAmount(seller && Number(seller.balance) > 0 ? Number(seller.balance).toFixed(2) : "");
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione...</option>
                  {(sellers ?? [])
                    .filter((s) => Number(s.balance) > 0)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — saldo {formatBRL(Number(s.balance))}
                      </option>
                    ))}
                </select>
              </div>

              <div className="rounded-xl border border-border/60 bg-secondary/40 p-4 text-sm">
                <span className="text-muted-foreground">Saldo disponível</span>
                <strong className="mt-1 block text-xl text-primary">
                  {formatBRL(Number(selectedPayoutSeller?.balance || 0))}
                </strong>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payout-amount">Valor enviado (R$)</Label>
                <Input
                  id="payout-amount"
                  type="number"
                  min="0.01"
                  max={selectedPayoutSeller ? Number(selectedPayoutSeller.balance) : undefined}
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payout-note">Observação</Label>
                <Input
                  id="payout-note"
                  maxLength={200}
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  placeholder="Ex.: PIX enviado em 03/10"
                />
              </div>

              <Button type="submit" className="w-full" disabled={payout.isPending || !payoutSellerId}>
                {payout.isPending ? "Registrando..." : "Confirmar pagamento"}
              </Button>
            </div>
          </form>

          <div className="rounded-2xl border border-border/70 bg-card p-5 overflow-x-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Histórico de pagamentos</h2>
                <p className="text-xs text-muted-foreground">
                  Registros são permanentes para manter a auditoria financeira.
                </p>
              </div>
              <div className="text-right text-xs">
                <div>Já pagos: <strong>{formatBRL(totalPaid)}</strong></div>
                <div>Em aberto: <strong className="text-primary">{formatBRL(totalBalance)}</strong></div>
              </div>
            </div>
            <table className="mt-4 w-full min-w-[620px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Vendedor</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Observação</th>
                </tr>
              </thead>
              <tbody>
                {(payouts ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="px-3 py-2 font-medium">{p.seller_name || "Vendedor"}</td>
                    <td className="px-3 py-2 font-semibold text-primary">{formatBRL(Number(p.amount))}</td>
                    <td className="px-3 py-2">{new Date(p.paid_at).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.note || "—"}</td>
                  </tr>
                ))}
                {(payouts ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhum pagamento registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

