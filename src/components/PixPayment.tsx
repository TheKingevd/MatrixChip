import { useState } from "react";
import { Copy, Check, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePixSettings, useSupportPhone, whatsAppLink } from "@/lib/catalog";

export function PixPayment() {
  const pix = usePixSettings();
  const phone = useSupportPhone();
  const [copied, setCopied] = useState(false);

  if (!pix.key && !pix.pixToLink) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pix.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="pix" className="mx-auto max-w-3xl px-5 py-16">
      <div className="neon-card heartbeat-glow rounded-2xl border bg-card p-6 md:p-8">
        <div className="flex items-center gap-2 text-primary">
          <QrCode className="size-5" />
          <span className="font-display text-sm font-semibold uppercase tracking-wide">
            Pagamento via PIX
          </span>
        </div>
        <h2 className="mt-3 font-display text-2xl font-bold md:text-3xl">
          Pague com PIX e ative na hora
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Copie a chave abaixo, faça o pagamento e envie o comprovante no WhatsApp para liberarmos
          seu número.
        </p>

        {pix.pixToLink && (
          <div className="mt-6">
            <Button className="btn-pop w-full sm:w-auto" asChild>
              <a href={pix.pixToLink} target="_blank" rel="noreferrer">
                <QrCode className="mr-2 size-4" />
                Pagar agora com Pix.to
              </a>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Pagamento seguro no Pix.to. Ao finalizar, envie o comprovante para liberarmos o
              número na hora.
            </p>
          </div>
        )}

        {pix.key && (
        <div className="mt-6 rounded-xl border border-border/70 bg-background/50 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Chave PIX{pix.keyType ? ` · ${pix.keyType}` : ""}
          </p>
          <p className="mt-1 break-all font-mono text-base text-foreground">{pix.key}</p>
          {(pix.holder || pix.bank) && (
            <p className="mt-2 text-sm text-muted-foreground">
              {pix.holder}
              {pix.holder && pix.bank ? " · " : ""}
              {pix.bank}
            </p>
          )}
        </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {pix.key && (
          <Button type="button" className="btn-pop" onClick={copy}>
            {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
            {copied ? "Chave copiada!" : "Copiar chave PIX"}
          </Button>
          )}
          <Button variant="outline" className="btn-pop" asChild>
            <a
              href={whatsAppLink(
                "Olá! Fiz o pagamento via PIX e quero enviar o comprovante para ativar meu número.",
                phone,
              )}
              target="_blank"
              rel="noreferrer"
            >
              Enviar comprovante
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
