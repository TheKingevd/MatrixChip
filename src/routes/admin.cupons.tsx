import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { saveCouponServerFn, deleteCouponServerFn } from "@/lib/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flag } from "@/components/Flag";
import { couponScopeLabel, useCoupons, type Coupon } from "@/lib/coupons";
import { useCatalog } from "@/lib/catalog";

export const Route = createFileRoute("/admin/cupons")({
  component: CuponsPage,
});

const EMPTY = {
  code: "",
  percent: "10",
  country_code: "",
  number_type: "",
  expires_at: "",
  active: true,
};

function CuponsPage() {
  const { data: coupons, isLoading } = useCoupons();
  const { catalog } = useCatalog();
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const countryName = (code: string) => catalog.find((c) => c.code === code)?.name;

  const save = useMutation({
    mutationFn: async () => {
      const code = form.code.trim().toUpperCase();
      const percent = Number(form.percent) || 0;
      if (!code) throw new Error("Informe o código do cupom");
      if (percent <= 0 || percent > 100)
        throw new Error("O desconto deve ser entre 1% e 100%");

      await saveCouponServerFn({
        data: {
          id: editingId || undefined,
          code,
          percent,
          country_code: form.country_code || null,
          number_type: form.number_type || null,
          expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null,
          active: form.active,
        },
      });
    },
    onSuccess: () => {
      toast.success(editingId ? "Cupom atualizado" : "Cupom criado");
      setEditingId(null);
      setForm(EMPTY);
      void qc.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteCouponServerFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Cupom removido");
      void qc.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      percent: String(c.percent),
      country_code: c.country_code ?? "",
      number_type: c.number_type ?? "",
      expires_at: c.expires_at ? c.expires_at.slice(0, 10) : "",
      active: c.active,
    });
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Cupons de desconto</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Crie cupons com desconto por país e/ou produto. Cupons ativos aparecem no site e podem ser
        aplicados no PDV.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="mt-6 grid gap-4 rounded-2xl border border-border/70 bg-card p-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="ccode">Código do cupom</Label>
          <Input
            id="ccode"
            value={form.code}
            maxLength={30}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            placeholder="BEMVINDO10"
            className="uppercase"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cpercent">Desconto (%)</Label>
          <Input
            id="cpercent"
            type="number"
            min={1}
            max={100}
            value={form.percent}
            onChange={(e) => set("percent", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ccountry">País (opcional)</Label>
          <select
            id="ccountry"
            value={form.country_code}
            onChange={(e) => set("country_code", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos os países</option>
            {catalog.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.dial})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cproduct">Produto (opcional)</Label>
          <select
            id="cproduct"
            value={form.number_type}
            onChange={(e) => set("number_type", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos os produtos</option>
            <option value="whatsapp">WhatsApp pessoal</option>
            <option value="business">WhatsApp Business</option>
            <option value="ambos">Ambos</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cexpires">Validade (opcional)</Label>
          <Input
            id="cexpires"
            type="date"
            value={form.expires_at}
            onChange={(e) => set("expires_at", e.target.value)}
          />
        </div>
        <div className="flex items-end gap-3">
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="size-4 accent-primary"
            />
            Ativo
          </label>
          <Button type="submit" disabled={save.isPending} className="flex-1">
            {save.isPending ? "Salvando…" : editingId ? "Salvar alterações" : "Criar cupom"}
          </Button>
          {editingId && (
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
          )}
        </div>
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Desconto</th>
              <th className="px-4 py-3">Abrangência</th>
              <th className="px-4 py-3">Validade</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(coupons ?? []).map((c) => {
              const expired = c.expires_at != null && new Date(c.expires_at).getTime() < Date.now();
              return (
                <tr key={c.id} className="border-t border-border/60 align-top">
                  <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                  <td className="px-4 py-3">{Number(c.percent)}%</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      {c.country_code && (
                        <Flag code={c.country_code} name={countryName(c.country_code) ?? ""} />
                      )}
                      {couponScopeLabel(c, countryName)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString("pt-BR") : "Sem validade"}
                  </td>
                  <td className="px-4 py-3">
                    {!c.active ? (
                      <span className="text-muted-foreground">Inativo</span>
                    ) : expired ? (
                      <span className="text-destructive">Expirado</span>
                    ) : (
                      <span className="text-primary">Ativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(c.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(coupons ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {isLoading ? "Carregando…" : "Nenhum cupom criado ainda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

