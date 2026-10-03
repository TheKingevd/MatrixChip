import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { loginServerFn } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar na Minha Conta — Matrix Online" },
      {
        name: "description",
        content: "Acesse sua conta para acompanhar pedidos, pagamentos e entregas. Administradores continuam sendo direcionados ao painel.",
      },
      { property: "og:title", content: "Entrar na Minha Conta — Matrix Online" },
      { property: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, setAuthData } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) void navigate({ to: session.user.role === "customer" ? "/conta" : "/admin" });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await loginServerFn({
        data: {
          email: email.trim(),
          password,
        },
      });

      setAuthData(result.user);
      void navigate({ to: result.user.role === "customer" ? "/conta" : "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "E-mail ou senha inválidos.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hero-bg flex min-h-screen items-center justify-center px-5 bg-background">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border/70 bg-card p-8 shadow-card"
      >
        <div className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-glow">
            <Zap className="size-5 fill-current" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">Matrix Online</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Minha Conta
            </p>
          </div>
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold text-foreground">Entrar na Minha Conta</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Acompanhe suas compras, pagamentos, preparação e entrega dos seus chips físicos.
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@dominio.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              maxLength={100}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full btn-pop shadow-glow" disabled={busy}>
            {busy ? "Entrando..." : "Entrar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
