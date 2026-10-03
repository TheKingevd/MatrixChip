import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag } from "@/components/Flag";
import { formatBRL } from "@/lib/catalog";
import {
  SALE_STATUSES,
  normalizeStatus,
  paymentLabel,
  productLabel,
  statusColor,
} from "@/lib/sales-status";
import {
  getSalesServerFn,
  updateSaleStatusServerFn,
  updatePixStatusServerFn,
} from "@/lib/api.functions";
import { MapPin, Package, Truck, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/historico")({
  component: HistoricoPage,
});

const PIX_STATUSES = [
  { value: "aguardando", label: "PIX aguardando", color: "#eab308" },
  { value: "comprovante_enviado", label: "Comprovante enviado", color: "#38bdf8" },
  { value: "confirmado", label: "PIX confirmado", color: "#22c55e" },
] as const;

function pixStatusMeta(value: string | null | undefined) {
  return PIX_STATUSES.find((s) => s.value === value) ?? PIX_STATUSES[0];
}

function HistoricoPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [editingTracking, setEditingTracking] = useState<{ id: string; code: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const rows = await getSalesServerFn();
      return (rows ?? []) as any[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      await updateSaleStatusServerFn({ data: { id, status: value } });
    },
    onSuccess: () => {
      toast.success("Status do pedido atualizado");
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTracking = useMutation({
    mutationFn: async ({ id, code }: { id: string; code: string }) => {
      await updateSaleStatusServerFn({
        data: {
          id,
          tracking_code: code,
          status: code.trim() ? "enviado" : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Código de rastreamento salvo com sucesso!");
      setEditingTracking(null);
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePixStatus = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      await updatePixStatusServerFn({ data: { id, pix_status: value } });
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.value === "confirmado"
          ? "PIX confirmado — pedido marcado como pago"
          : "Status do PIX atualizado"
      );
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (status !== "todos" && normalizeStatus(r.status) !== status) return false;
      if (!term) return true;
      return [
        r.id,
        r.country_name,
        r.country_code,
        r.dial,
        r.ddd,
        r.customer_name,
        r.customer_phone,
        r.customer_cpf,
        r.city,
        r.state,
        r.cep,
        r.tracking_code,
        r.payment_method,
        r.status,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [data, q, status]);

  const total = rows.reduce((s, r) => s + Number(r.total), 0);

  return (
    <div>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Pedidos e Envios de Chips</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os pedidos de chips físicos recebidos, visualize o endereço de entrega e informe o código de rastreamento dos Correios.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_220px]">
        <div className="space-y-1.5">
          <Label htmlFor="busca">Pesquisar Pedido</Label>
          <Input
            id="busca"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nº Pedido, nome do cliente, CPF, cidade, rastreio…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fstatus">Filtrar por Status</Label>
          <select
            id="fstatus"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="todos">Todos</option>
            {SALE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {rows.length} pedido(s) listado(s) · Volume total: <strong>{formatBRL(total)}</strong>
      </p>

      {/* LISTA DE PEDIDOS */}
      <div className="mt-4 space-y-4">
        {rows.map((r) => {
          const pixMeta = pixStatusMeta(r.pix_status);
          const hasDeliveryAddress = r.street && r.city;

          return (
            <div
              key={r.id}
              className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Lado Esquerdo: Dados do Pedido e Destinatário */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded">
                      {r.id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </span>
                    <Badge variant="outline" className="text-[11px]">
                      {r.delivery === "chip" ? "Chip Físico" : "Virtual"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Flag code={r.country_code} name={r.country_name} />
                    <span>
                      Chip {r.country_name} {r.ddd ? `(DDD ${r.ddd})` : ""}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-bold text-primary">{formatBRL(Number(r.total))}</span>
                  </div>

                  <p className="text-sm font-semibold text-foreground">
                    Destinatário: {r.customer_name}{" "}
                    {r.customer_cpf && (
                      <span className="text-xs font-normal text-muted-foreground">
                        (CPF: {r.customer_cpf})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    WhatsApp: {r.customer_phone || "Não informado"}{" "}
                    {r.customer_email ? `· E-mail: ${r.customer_email}` : ""}
                  </p>

                  {/* Endereço de Entrega Físico */}
                  {hasDeliveryAddress ? (
                    <div className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-2.5 text-xs text-foreground space-y-0.5">
                      <p className="font-semibold text-primary flex items-center gap-1">
                        <MapPin className="size-3.5" /> Endereço para Envio dos Correios:
                      </p>
                      <p>
                        {r.street}, {r.number} {r.complement ? `(${r.complement})` : ""} -{" "}
                        {r.neighborhood}
                      </p>
                      <p>
                        {r.city} / {r.state} — <strong>CEP: {r.cep}</strong>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Endereço físico não registrado neste pedido antigo.
                    </p>
                  )}

                  {/* Código de Rastreamento */}
                  <div className="mt-2 flex items-center gap-2">
                    <Truck className="size-4 text-muted-foreground" />
                    {editingTracking?.id === r.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          size={15}
                          className="h-8 text-xs font-mono"
                          value={editingTracking?.code ?? ""}
                          placeholder="Ex: AA123456789BR"
                          onChange={(e) =>
                            setEditingTracking({ id: r.id, code: e.target.value.toUpperCase() })
                          }
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            if (editingTracking) {
                              saveTracking.mutate({ id: r.id, code: editingTracking.code });
                            }
                          }}
                        >
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => setEditingTracking(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <span>Rastreio:</span>
                        {r.tracking_code ? (
                          <span className="font-mono font-bold text-primary">
                            {r.tracking_code}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Não informado</span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px]"
                          onClick={() =>
                            setEditingTracking({ id: r.id, code: r.tracking_code || "" })
                          }
                        >
                          {r.tracking_code ? "Alterar" : "Cadastrar Rastreio"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lado Direito: Ações de Status e PIX */}
                <div className="flex flex-col items-end gap-3">
                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Status do Envio
                    </label>
                    <select
                      value={normalizeStatus(r.status)}
                      onChange={(e) =>
                        updateStatus.mutate({ id: r.id, value: e.target.value })
                      }
                      className="block h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                    >
                      {SALE_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Pagamento PIX
                    </label>
                    <select
                      value={r.pix_status || "aguardando"}
                      onChange={(e) =>
                        updatePixStatus.mutate({ id: r.id, value: e.target.value })
                      }
                      className="block h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                    >
                      {PIX_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="rounded-2xl border border-border/70 bg-card p-12 text-center text-muted-foreground">
            {isLoading ? "Carregando pedidos..." : "Nenhum pedido encontrado."}
          </div>
        )}
      </div>
    </div>
  );
}

