import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { saveSellerServerFn, deleteSellerServerFn, getSalesServerFn } from "@/lib/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/catalog";
import { useSellers, type Seller } from "@/lib/sellers";

export const Route = createFileRoute("/admin/comissoes")({
  component: ComissoesPage,
});

const EMPTY = { name: "", commission_percent: "10", active: true };

type SaleRow = { seller_id: string | null; total: number | string; status: string };

function useSalesBySeller() {
  return useQuery({
    queryKey: ["sales", "by-seller"],
    queryFn: async () => {
      const rows = await getSalesServerFn();
      return (rows ?? []) as SaleRow[];
    },
    staleTime: 30_000,
  });
}

function ComissoesPage() {
  const { data: sellers, isLoading } = useSellers();
  const { data: sales } = useSalesBySeller();
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    let unassigned = { count: 0, revenue: 0 };
    for (const s of sales ?? []) {
      if (s.status === "cancelada") continue;
      const total = Number(s.total) || 0;
      if (!s.seller_id) {
        unassigned = { count: unassigned.count + 1, revenue: unassigned.revenue + total };
        continue;
      }
      const cur = map.get(s.seller_id) ?? { count: 0, revenue: 0 };
      map.set(s.seller_id, { count: cur.count + 1, revenue: cur.revenue + total });
    }
    return { map, unassigned };
  }, [sales]);

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

  const totalCommission = (sellers ?? []).reduce((acc, s) => {
    const st = stats.map.get(s.id);
    return acc + ((st?.revenue ?? 0) * Number(s.commission_percent)) / 100;
  }, 0);

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
                  const st = stats.map.get(s.id) ?? { count: 0, revenue: 0 };
                  const commission = (st.revenue * Number(s.commission_percent)) / 100;
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
                      <td className="px-3 py-2">{st.count}</td>
                      <td className="px-3 py-2">{formatBRL(st.revenue)}</td>
                      <td className="px-3 py-2 font-semibold text-primary">
                        {formatBRL(commission)}
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
              {stats.unassigned.count > 0 ? (
                <tr className="border-t border-border/60 text-muted-foreground">
                  <td className="px-3 py-2">Sem vendedor</td>
                  <td className="px-3 py-2">—</td>
                  <td className="px-3 py-2">{stats.unassigned.count}</td>
                  <td className="px-3 py-2">{formatBRL(stats.unassigned.revenue)}</td>
                  <td className="px-3 py-2">—</td>
                  <td />
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/60 font-semibold">
                <td className="px-3 py-2" colSpan={4}>
                  Total de comissões
                </td>
                <td className="px-3 py-2 text-primary">{formatBRL(totalCommission)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

