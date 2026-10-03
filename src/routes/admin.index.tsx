import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Globe2, ShoppingCart, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSalesServerFn } from "@/lib/api.functions";
import { countries } from "@/data/countries";
import { formatBRL } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import {
  SALE_STATUSES,
  normalizeStatus,
  paymentLabel,
  productLabel,
  statusColor,
  statusLabel,
} from "@/lib/sales-status";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

const PERIODS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "all", label: "Tudo" },
] as const;

const PALETTE = [
  "hsl(152 65% 45%)",
  "hsl(217 91% 60%)",
  "hsl(271 81% 66%)",
  "hsl(45 93% 47%)",
  "hsl(340 75% 55%)",
  "hsl(190 80% 45%)",
];

const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
    color: "hsl(var(--foreground))",
  },
} as const;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      <div className="mt-4 h-64 w-full">{children}</div>
    </div>
  );
}

function AdminHome() {
  const [period, setPeriod] = useState<string>("30");

  const { data: sales } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const data = await getSalesServerFn();
      return (data ?? []) as any[];
    },
  });

  const all = sales ?? [];

  const rows = useMemo(() => {
    if (period === "all") return all;
    const days = Number(period);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return all.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  }, [all, period]);

  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  const today = rows.filter(
    (r) => new Date(r.created_at).toDateString() === new Date().toDateString(),
  );
  const todayTotal = today.reduce((s, r) => s + Number(r.total), 0);

  const byCountry = useMemo(() => {
    const map = new Map<string, { name: string; total: number; qtd: number }>();
    for (const r of rows) {
      const cur = map.get(r.country_code) ?? { name: r.country_name, total: 0, qtd: 0 };
      cur.total += Number(r.total);
      cur.qtd += r.quantity;
      map.set(r.country_code, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [rows]);

  const byProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = productLabel(r.number_type, r.delivery);
      map.set(k, (map.get(k) ?? 0) + Number(r.total));
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);

  const byPeriod = useMemo(() => {
    const days = period === "all" ? 90 : Number(period);
    const buckets: { label: string; total: number }[] = [];
    const index = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      index.set(key, buckets.length);
      buckets.push({
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        total: 0,
      });
    }
    for (const r of rows) {
      const key = new Date(r.created_at).toDateString();
      const i = index.get(key);
      if (i !== undefined) buckets[i]!.total += Number(r.total);
    }
    return buckets;
  }, [rows, period]);

  const byStatus = useMemo(() => {
    const map = new Map<string, { qtd: number; total: number }>();
    for (const r of rows) {
      const k = normalizeStatus(r.status);
      const cur = map.get(k) ?? { qtd: 0, total: 0 };
      cur.qtd += 1;
      cur.total += Number(r.total);
      map.set(k, cur);
    }
    return SALE_STATUSES.map((s) => ({
      status: s.value,
      label: s.label,
      color: s.color,
      ...(map.get(s.value) ?? { qtd: 0, total: 0 }),
    }));
  }, [rows]);

  const byPayment = useMemo(() => {
    const map = new Map<string, { qtd: number; total: number }>();
    for (const r of rows) {
      const k = r.payment_method;
      const cur = map.get(k) ?? { qtd: 0, total: 0 };
      cur.qtd += 1;
      cur.total += Number(r.total);
      map.set(k, cur);
    }
    return [...map.entries()]
      .map(([method, v]) => ({ method, label: paymentLabel(method), ...v }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const cards = [
    { icon: TrendingUp, label: "Faturamento no período", value: formatBRL(total) },
    { icon: CreditCard, label: "Vendas hoje", value: `${today.length} · ${formatBRL(todayTotal)}` },
    { icon: ShoppingCart, label: "Vendas no período", value: String(rows.length) },
    { icon: Globe2, label: "Países no catálogo", value: String(countries.length) },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Visão geral</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border/70 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`rounded-md px-3 py-1 text-sm transition-colors ${
                  period === p.value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button asChild size="sm">
            <Link to="/admin/pdv">Nova venda no PDV</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/70 bg-card p-5">
            <c.icon className="size-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">{c.label}</p>
            <p className="font-display text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Panel title="Faturamento por período">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byPeriod}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => formatBRL(Number(v))} />
              <Tooltip {...chartTooltip} formatter={(v) => formatBRL(Number(v))} />
              <Line
                type="monotone"
                dataKey="total"
                name="Faturamento"
                stroke="hsl(152 65% 45%)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top países (faturamento)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCountry}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} height={50} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => formatBRL(Number(v))} />
              <Tooltip {...chartTooltip} formatter={(v) => formatBRL(Number(v))} />
              <Bar dataKey="total" name="Faturamento" radius={[6, 6, 0, 0]} fill="hsl(217 91% 60%)" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Vendas por produto">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byProduct} dataKey="value" nameKey="name" outerRadius={85} label={false}>
                {byProduct.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip {...chartTooltip} formatter={(v) => formatBRL(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Vendas por status">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => formatBRL(Number(v))} />
              <Tooltip {...chartTooltip} formatter={(v) => formatBRL(Number(v))} />
              <Bar dataKey="total" name="Faturamento" radius={[6, 6, 0, 0]}>
                {byStatus.map((s) => (
                  <Cell key={s.status} fill={s.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="font-display text-sm font-semibold">Total por status</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {byStatus.map((s) => (
              <li key={s.status} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  {s.label}
                  <span className="text-muted-foreground">· {s.qtd}</span>
                </span>
                <span className="font-medium">{formatBRL(s.total)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="font-display text-sm font-semibold">Total por pagamento</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {byPayment.map((p) => (
              <li key={p.method} className="flex items-center justify-between gap-3">
                <span>
                  {p.label} <span className="text-muted-foreground">· {p.qtd}</span>
                </span>
                <span className="font-medium">{formatBRL(p.total)}</span>
              </li>
            ))}
            {byPayment.length === 0 && (
              <li className="text-muted-foreground">Nenhuma venda no período.</li>
            )}
          </ul>
        </div>
      </div>

      <h2 className="mt-10 font-display text-lg font-semibold">Últimas vendas</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">País</th>
              <th className="px-4 py-3">Qtd</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-4 py-3">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">{r.customer_name}</td>
                <td className="px-4 py-3">
                  {r.country_name} ({r.dial})
                </td>
                <td className="px-4 py-3">{r.quantity}</td>
                <td className="px-4 py-3">{paymentLabel(r.payment_method)}</td>
                <td className="px-4 py-3">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{ backgroundColor: `${statusColor(r.status)}22`, color: statusColor(r.status) }}
                  >
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{formatBRL(Number(r.total))}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma venda registrada no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

