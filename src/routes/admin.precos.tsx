import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { upsertCountryOverrideServerFn } from "@/lib/api.functions";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/Flag";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { regions } from "@/data/countries";
import { formatBRL, useCatalog } from "@/lib/catalog";

export const Route = createFileRoute("/admin/precos")({
  component: PrecosPage,
});

type Draft = { price: number; stock: number; active: boolean };

function PrecosPage() {
  const { catalog } = useCatalog();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<(typeof regions)[number]>("Todos");
  const [drafts, setDrafts] = useState<Record<string, Partial<Draft>>>({});
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter(
      (c) =>
        (region === "Todos" || c.region === region) &&
        (!q || c.name.toLowerCase().includes(q) || c.dial.includes(q)),
    );
  }, [catalog, query, region]);

  const save = async (code: string, base: Draft) => {
    const d = { ...base, ...drafts[code] };
    setSavingCode(code);
    setMsg(null);
    try {
      await upsertCountryOverrideServerFn({
        data: {
          code,
          price: d.price,
          stock: d.stock,
          active: d.active,
        },
      });
    } catch {
      setSavingCode(null);
      setMsg("Erro ao salvar. Tente novamente.");
      return;
    }
    setSavingCode(null);
    await qc.invalidateQueries({ queryKey: ["country_overrides"] });
    setDrafts((p) => {
      const n = { ...p };
      delete n[code];
      return n;
    });
    setMsg(`Preço de ${code} atualizado.`);
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Preços e estoque</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ajuste o valor, o estoque e a disponibilidade de cada país. As mudanças aparecem no site na
        hora.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar país ou DDI"
            className="pl-9"
            aria-label="Buscar país"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {regions.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={region === r ? "default" : "outline"}
              onClick={() => setRegion(r)}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      {msg && <p className="mt-4 text-sm text-primary">{msg}</p>}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3">País</th>
              <th className="px-4 py-3">Preço atual</th>
              <th className="px-4 py-3">Novo preço</th>
              <th className="px-4 py-3">Estoque</th>
              <th className="px-4 py-3">Ativo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 300).map((c) => {
              const d = drafts[c.code] ?? {};
              return (
                <tr key={c.code} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-4 py-2">
                    <Flag code={c.code} name={c.name} className="mr-2 inline-block h-4 w-6 rounded-[3px] object-cover align-[-2px]" />
                    {c.name} <span className="text-muted-foreground">{c.dial}</span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{formatBRL(c.price)}</td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-9 w-28"
                      value={d.price ?? c.price}
                      onChange={(e) =>
                        setDrafts((p) => ({
                          ...p,
                          [c.code]: { ...p[c.code], price: Number(e.target.value) || 0 },
                        }))
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min={0}
                      className="h-9 w-24"
                      value={d.stock ?? c.stock}
                      onChange={(e) =>
                        setDrafts((p) => ({
                          ...p,
                          [c.code]: { ...p[c.code], stock: Number(e.target.value) || 0 },
                        }))
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Switch
                      checked={d.active ?? c.active}
                      onCheckedChange={(v) =>
                        setDrafts((p) => ({ ...p, [c.code]: { ...p[c.code], active: v } }))
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={savingCode === c.code}
                      onClick={() =>
                        void save(c.code, { price: c.price, stock: c.stock, active: c.active })
                      }
                    >
                      {savingCode === c.code ? "..." : "Salvar"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

