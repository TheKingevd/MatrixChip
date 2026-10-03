import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FileImage, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/Flag";
import { formatBRL } from "@/lib/catalog";
import { productLabel } from "@/lib/sales-status";
import {
  getSalesServerFn,
  updatePixStatusServerFn,
  uploadReceiptServerFn,
} from "@/lib/api.functions";

export const Route = createFileRoute("/admin/pix")({
  component: PixEnviosPage,
});

const PIX_STATUSES = [
  { value: "aguardando", label: "Aguardando", color: "#eab308" },
  { value: "comprovante_enviado", label: "Comprovante enviado", color: "#38bdf8" },
  { value: "confirmado", label: "Confirmado", color: "#22c55e" },
] as const;

type SaleRow = {
  id: string;
  created_at: string;
  country_code: string;
  country_name: string;
  dial: string;
  ddd: string | null;
  customer_name: string;
  customer_phone: string | null;
  number_type: string;
  delivery: string;
  total: number;
  pix_status: string;
  pix_confirmed_at: string | null;
  receipt_path: string | null;
};

function PixEnviosPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("todos");
  const [receiptUrl, setReceiptUrl] = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sales", "pix"],
    queryFn: async () => {
      const rows = await getSalesServerFn();
      return (rows ?? []) as SaleRow[];
    },
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["sales"] });

  const setStatus = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      await updatePixStatusServerFn({ data: { id, pix_status: value } });
    },
    onSuccess: (_d, v) => {
      toast.success(
        v.value === "confirmado" ? "Pagamento confirmado com data e hora" : "Status atualizado",
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadReceipt = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      // Converte o arquivo para Data URL e salva no SQLite
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await uploadReceiptServerFn({
        data: {
          id,
          receipt_data_url: dataUrl,
        },
      });
    },
    onSuccess: () => {
      toast.success("Comprovante anexado — status marcado como enviado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const viewReceipt = (sale: SaleRow) => {
    if (!sale.receipt_path) return;
    setReceiptUrl({ url: sale.receipt_path, name: sale.customer_name });
  };

  const rows = (data ?? []).filter((r) => filter === "todos" || r.pix_status === filter);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Envios e Comprovantes PIX</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Acompanhe os pagamentos PIX recebidos para chips físicos, anexe comprovantes e confirme o pagamento.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {([{ value: "todos", label: "Todos" }, ...PIX_STATUSES] as { value: string; label: string }[]).map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setFilter(s.value)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              filter === s.value
                ? "border-primary bg-primary/15 text-primary font-medium"
                : "border-border/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadTarget) uploadReceipt.mutate({ id: uploadTarget, file });
          e.target.value = "";
          setUploadTarget(null);
        }}
      />

      <div className="mt-6 space-y-4">
        {rows.map((r) => {
          const meta = PIX_STATUSES.find((s) => s.value === r.pix_status) ?? PIX_STATUSES[0];
          return (
            <div
              key={r.id}
              className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 font-medium">
                    <Flag code={r.country_code} name={r.country_name} />
                    Chip {r.country_name} ({r.dial})
                    {r.ddd ? ` · DDD ${r.ddd}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Destinatário: {r.customer_name}
                    {r.customer_phone ? ` · Tel: ${r.customer_phone}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pedido {r.id} em {new Date(r.created_at).toLocaleString("pt-BR")} ·{" "}
                    <strong>{formatBRL(Number(r.total))}</strong>
                  </p>
                  <p className="text-sm font-medium" style={{ color: meta.color }}>
                    {meta.label}
                    {r.pix_confirmed_at
                      ? ` em ${new Date(r.pix_confirmed_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={uploadReceipt.isPending}
                    onClick={() => {
                      setUploadTarget(r.id);
                      fileRef.current?.click();
                    }}
                  >
                    <Upload className="mr-2 size-4" />
                    {r.receipt_path ? "Trocar comprovante" : "Anexar comprovante"}
                  </Button>
                  {r.receipt_path && (
                    <Button size="sm" variant="outline" onClick={() => viewReceipt(r)}>
                      <FileImage className="mr-2 size-4" /> Ver comprovante
                    </Button>
                  )}
                  {r.pix_status !== "confirmado" ? (
                    <Button
                      size="sm"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: r.id, value: "confirmado" })}
                    >
                      <CheckCircle2 className="mr-2 size-4" /> Confirmar pagamento
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: r.id, value: "aguardando" })}
                    >
                      <XCircle className="mr-2 size-4" /> Desfazer confirmação
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="rounded-2xl border border-border/70 bg-card px-4 py-8 text-center text-muted-foreground">
            {isLoading ? "Carregando…" : "Nenhuma solicitação PIX neste filtro."}
          </p>
        )}
      </div>

      {receiptUrl && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5"
          onClick={() => setReceiptUrl(null)}
        >
          <div
            className="max-h-[85vh] max-w-2xl overflow-auto rounded-2xl border border-border bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">Comprovante — {receiptUrl.name}</p>
              <Button size="sm" variant="outline" onClick={() => setReceiptUrl(null)}>
                Fechar
              </Button>
            </div>
            {receiptUrl.url.toLowerCase().includes(".pdf") ? (
              <iframe src={receiptUrl.url} title="Comprovante" className="h-[70vh] w-full rounded-lg" />
            ) : (
              <img src={receiptUrl.url} alt="Comprovante PIX" className="max-h-[70vh] rounded-lg" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

