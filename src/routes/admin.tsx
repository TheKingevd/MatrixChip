import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel Administrativo — Matrix Online" },
      { name: "description", content: "Gerencie pedidos, estoques e entregas de chips físicos da Matrix Online." },
      { property: "og:title", content: "Painel Administrativo — Matrix Online" },
      { property: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const links = [
  { to: "/admin", label: "Visão Geral", exact: true },
  { to: "/admin/historico", label: "Pedidos & Envios" },
  { to: "/admin/pdv", label: "PDV" },
  { to: "/admin/pix", label: "Envios PIX" },
  { to: "/admin/precos", label: "Preços & Estoque" },
  { to: "/admin/cupons", label: "Cupons" },
  { to: "/admin/comissoes", label: "Comissões" },
  { to: "/admin/vendedores", label: "Vendedores" },
  { to: "/admin/admins", label: "Administradores" },
  { to: "/admin/config", label: "Configurações" },
] as const;

function AdminLayout() {
  const { loading, session, isAdmin, signOut, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground bg-background">
        Carregando painel Matrix Online…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center px-5 text-center bg-background">
        <div>
          <h1 className="font-display text-2xl font-bold">Acesso Restrito</h1>
          <p className="mt-2 text-muted-foreground">
            Sua conta não possui permissão administrativa no Matrix Online.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/70 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-gradient text-primary-foreground shadow-glow">
              <Zap className="size-4 fill-current" />
            </span>
            <div className="flex flex-col">
              <span className="font-display text-base font-bold leading-tight">Matrix Online</span>
              <span className="text-[10px] text-primary uppercase font-mono">Gestão de Chips Físicos</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline font-mono">
              {user?.email}
            </span>
            <Button size="sm" variant="outline" onClick={() => void signOut()} className="h-8 text-xs">
              <LogOut className="mr-1.5 size-3.5" /> Sair
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2.5 sm:px-5">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: "exact" in l }}
              activeProps={{ className: "bg-primary/15 text-primary font-semibold" }}
              className="rounded-lg px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
