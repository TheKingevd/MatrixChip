import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Check,
  Globe2,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Smartphone,
  Truck,
  Zap,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/Flag";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { regions, type NumberType } from "@/data/countries";
import { BRAZIL_DDDS } from "@/data/ddd";
import { formatBRL, useCatalog, useSupportPhone, whatsAppLink } from "@/lib/catalog";
import { SalesTicker } from "@/components/SalesTicker";
import { PixPayment } from "@/components/PixPayment";
import {
  PhysicalChipCheckoutModal,
  type CheckoutItem,
} from "@/components/PhysicalChipCheckoutModal";
import globeBg from "@/assets/globe-connections.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Matrix Online — Chips Físicos Nacionais e Internacionais" },
      {
        name: "description",
        content:
          "Compre chips físicos reais para WhatsApp, ligações e internet de +190 países e com todos os DDDs do Brasil. Envio rápido pelos Correios para todo o país.",
      },
      {
        property: "og:title",
        content: "Matrix Online — Loja Oficial de Chips Físicos",
      },
      {
        property: "og:description",
        content:
          "Chips físicos reais com envio expresso. Escolha seu DDD ou país de preferência e receba na sua porta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const typeFilters: { value: "todos" | NumberType; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "business", label: "WhatsApp Business" },
  { value: "ambos", label: "Ligações + WhatsApp" },
];

export function Index() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<(typeof regions)[number]>("Todos");
  const [type, setType] = useState<"todos" | NumberType>("todos");
  const [ddd, setDdd] = useState("11");
  const [checkoutItem, setCheckoutItem] = useState<CheckoutItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const phone = useSupportPhone();
  const { catalog } = useCatalog();
  const buildWhatsAppLink = (message: string) => whatsAppLink(message, phone);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((c) => {
      if (!c.active) return false;
      const matchQ =
        !q || c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase() === q;
      const matchR = region === "Todos" || c.region === region;
      const matchT = type === "todos" || c.type === type || c.type === "ambos";
      return matchQ && matchR && matchT;
    });
  }, [catalog, query, region, type]);

  const handleBuy = (item: { code: string; name: string; dial: string; price: number; type: string }) => {
    setCheckoutItem({
      code: item.code,
      name: item.name,
      dial: item.dial,
      price: item.price,
      ddd: item.code === "BR" ? ddd : undefined,
      type: item.type,
    });
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* HEADER MATRIX ONLINE */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-glow">
              <Zap className="size-5 fill-current" />
            </span>
            <div className="flex flex-col">
              <span className="font-display text-base font-black tracking-tight text-foreground sm:text-xl">
                MATRIX <span className="text-primary">ONLINE</span>
              </span>
              <span className="hidden text-[10px] font-medium tracking-widest text-muted-foreground uppercase sm:block">
                Chips Físicos & Conexão
              </span>
            </div>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a className="transition-colors hover:text-foreground" href="#chips">
              Chips Físicos
            </a>
            <a className="transition-colors hover:text-foreground" href="#como-funciona">
              Como funciona
            </a>
            <a className="transition-colors hover:text-foreground" href="#faq">
              Perguntas frequentes
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/auth"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Minha conta
            </a>
            <Button asChild size="sm" className="btn-pop shadow-glow">
              <a href={buildWhatsAppLink("Olá Matrix Online! Gostaria de tirar dúvidas sobre os chips físicos.")}>
                <WhatsAppIcon className="size-5 shrink-0 sm:mr-1.5" /> <span className="hidden sm:inline">Suporte WhatsApp</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* HERO SECTION */}
        <section className="hero-bg relative overflow-hidden border-b border-border/60">
          <img
            src={globeBg}
            alt="Rede de conexões Matrix Online"
            width={1920}
            height={1088}
            decoding="async"
            fetchPriority="high"
            className="pointer-events-none absolute inset-0 size-full object-cover opacity-35 mix-blend-screen"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background" />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20 md:py-28">
            <Badge variant="secondary" className="mb-6 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <Truck className="mr-1.5 size-3.5" /> Envio rápido para todo o Brasil · Chips Físicos Reais
            </Badge>
            <h1 className="max-w-3xl text-3xl font-extrabold leading-[1.08] sm:text-4xl md:text-6xl">
              Seu <span className="text-brand-gradient">Chip Físico</span> dedicado entregue na sua porta
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
              Compre chips físicos reais para WhatsApp, WhatsApp Business, SMS e voz. Escolha seu DDD
              preferido do Brasil ou chips internacionais de mais de 190 países com entrega direta na sua residência.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:mt-9 sm:flex-row sm:flex-wrap sm:gap-3">
              <Button asChild size="lg" className="btn-pop shadow-glow">
                <a href="#chips">
                  <Package className="mr-2 size-5" /> Ver chips disponíveis
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="btn-pop">
                <a href="#como-funciona">Como funciona a entrega</a>
              </Button>
            </div>

            <dl className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:mt-14 md:grid-cols-4">
              {[
                { k: "100% Físicos", v: "Chips reais e lacrados" },
                { k: "Todos os DDDs", v: "Do 11 ao 99 no Brasil" },
                { k: "Correios", v: "Rastreio ponto a ponto" },
                { k: "Suporte 24/7", v: "Atendimento humanizado" },
              ].map((s) => (
                <div
                  key={s.k}
                  className="neon-card heartbeat-glow rounded-2xl border bg-card/60 p-4 transition-transform hover:-translate-y-1"
                >
                  <dt className="font-display text-xl font-bold text-foreground sm:text-2xl">{s.k}</dt>
                  <dd className="text-xs text-muted-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* VITRINE DE CHIPS */}
        <section id="chips" className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-bold md:text-4xl text-foreground">Catálogo de Chips Físicos</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Selecione o chip físico desejado, preencha o endereço de entrega e receba pelos Correios com código de rastreamento.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:gap-4">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar país ou DDI (ex: Brasil, Estados Unidos, +1)"
                className="pl-9"
                aria-label="Buscar chip"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {regions.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  className="btn-pop"
                  variant={region === r ? "default" : "outline"}
                  onClick={() => setRegion(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {typeFilters.map((t) => (
                <Button
                  key={t.value}
                  size="sm"
                  className="btn-pop"
                  variant={type === t.value ? "secondary" : "ghost"}
                  onClick={() => setType(t.value)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* GRID DE CARDS */}
          <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <article
                key={c.code}
                className="neon-card heartbeat-glow flex flex-col rounded-2xl border bg-card p-5 shadow-card transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Flag code={c.code} name={c.name} className="h-8 w-11 rounded-md object-cover shadow-sm" />
                    <div>
                      <h3 className="font-display text-lg font-bold text-foreground">
                        Chip Físico {c.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {c.dial} · {c.region}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    {c.stock} em estoque
                  </Badge>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-primary shrink-0" />
                    <span>Compatível com WhatsApp e WhatsApp Business</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Truck className="size-4 text-primary shrink-0" />
                    <span>Envio físico pelos Correios para todo o Brasil</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary shrink-0" />
                    <span>Linha física dedicada e lacrada de fábrica</span>
                  </li>
                </ul>

                {/* Seleção de DDD se for Brasil */}
                {c.code === "BR" && (
                  <div className="mt-4 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <label htmlFor="ddd-select" className="text-xs font-semibold text-foreground">
                      Escolha o DDD de preferência:
                    </label>
                    <Select value={ddd} onValueChange={setDdd}>
                      <SelectTrigger id="ddd-select" className="w-full bg-background text-xs">
                        <SelectValue placeholder="Selecione o DDD" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {BRAZIL_DDDS.map((d) => (
                          <SelectItem key={d.ddd} value={d.ddd} className="text-xs">
                            ({d.ddd}) {d.city} — {d.uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="mt-6 flex flex-col items-stretch gap-3 border-t border-border/60 pt-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Preço do chip</p>
                    <p className="font-display text-2xl font-black text-foreground">
                      {formatBRL(c.price)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="btn-pop shadow-glow"
                    onClick={() => handleBuy(c)}
                  >
                    <Package className="mr-1.5 size-4" /> Comprar Chip Físico
                  </Button>
                </div>
              </article>
            ))}
          </div>

          {list.length === 0 && (
            <p className="mt-12 text-center text-muted-foreground">
              Nenhum chip encontrado para esta busca. Fale com nosso suporte para encomendas especiais.
            </p>
          )}
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="border-y border-border/60 bg-surface/40">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-3xl font-bold md:text-4xl text-center text-foreground">
              Como funciona o envio do seu Chip Físico
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground text-sm">
              Processo 100% automatizado, transparente e seguro do pedido até a sua porta.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-4">
              {[
                {
                  icon: Package,
                  t: "1. Escolha o Chip",
                  d: "Selecione o estado/DDD ou o país e clique em Comprar Chip Físico.",
                },
                {
                  icon: MapPin,
                  t: "2. Endereço de Entrega",
                  d: "Informe seu CEP e endereço completo para despacharmos a mercadoria.",
                },
                {
                  icon: Zap,
                  t: "3. Pagamento PIX",
                  d: "Pague com PIX com QR Code ou Copia e Cola instantâneo.",
                },
                {
                  icon: Truck,
                  t: "4. Envio & Rastreio",
                  d: "Embalamos e postamos seu chip nos Correios com código de rastreamento.",
                },
              ].map((s) => (
                <div
                  key={s.t}
                  className="neon-card heartbeat-glow rounded-2xl border bg-card p-6 transition-transform hover:-translate-y-1 text-left"
                >
                  <s.icon className="size-7 text-primary" />
                  <h3 className="mt-4 font-display text-lg font-bold text-foreground">{s.t}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PAGAMENTO PIX DIRETO */}
        <PixPayment />

        {/* PERGUNTAS FREQUENTES */}
        <section id="faq" className="mx-auto max-w-3xl px-4 py-14 sm:px-5 sm:py-20">
          <h2 className="text-3xl font-bold md:text-4xl text-center text-foreground">
            Perguntas Frequentes
          </h2>
          <Accordion type="single" collapsible className="mt-8">
            {[
              {
                q: "O chip é realmente físico?",
                a: "Sim! Trabalhamos com chips físicos reais (SIM card triplo corte: padrão, micro e nano), lacrados e prontos para inserção em qualquer smartphone ou modem.",
              },
              {
                q: "Como recebo o chip físico em minha casa?",
                a: "Após a confirmação do pagamento, seu pedido entra imediatamente em preparação e é postado via Correios ou transportadora parceira com código de rastreamento enviado diretamente no seu WhatsApp.",
              },
              {
                q: "Posso usar o chip para WhatsApp e WhatsApp Business?",
                a: "Sim! Todos os nossos chips físicos são 100% compatíveis com ativação do WhatsApp normal, WhatsApp Business e recebimento de códigos SMS de qualquer plataforma.",
              },
              {
                q: "Quanto tempo demora para chegar?",
                a: "O envio é feito no próximo dia útil após o pedido. O prazo médio de entrega varia de 2 a 7 dias úteis dependendo da sua localidade.",
              },
              {
                q: "Qualquer pessoa pode comprar?",
                a: "Sim! Não há burocracia ou contrato de fidelidade. Basta escolher o chip, preencher seus dados de entrega e efetuar o pagamento via PIX.",
              },
            ].map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`}>
                <AccordionTrigger className="text-left font-medium text-foreground">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* CTA FINAL */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="hero-bg rounded-3xl border border-border/70 p-5 text-center shadow-glow sm:p-10">
            <h2 className="text-3xl font-bold md:text-4xl text-foreground">
              Pronto para garantir seu Chip Físico?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground text-sm">
              Fale com nossa equipe pelo WhatsApp ou escolha seu chip agora mesmo no catálogo.
            </p>
            <Button asChild size="lg" className="btn-pop mt-8 shadow-glow">
              <a href={buildWhatsAppLink("Olá! Gostaria de pedir um chip físico pelo Matrix Online.")}>
                <WhatsAppIcon className="mr-2 size-5 shrink-0" /> Falar com um consultor
              </a>
            </Button>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border/60 py-10 bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary fill-current" />
            <span className="font-display font-bold text-foreground">Matrix Online</span>
          </div>
          <p className="text-xs">
            Venda oficial de chips físicos reais · Nacionais com todos os DDDs e Internacionais · Envio Correios.
          </p>
          <p className="text-xs">
            <a className="hover:text-foreground text-muted-foreground/80 underline" href="/auth">
              Painel Administrativo
            </a>
          </p>
          <p className="text-[11px] text-muted-foreground/60">
            © {new Date().getFullYear()} Matrix Online. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* MODAL DE CHECKOUT DE CHIP FÍSICO */}
      <PhysicalChipCheckoutModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        item={checkoutItem}
      />

      <SalesTicker />
    </div>
  );
}
