import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Shield, Trash2, UserPlus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminsServerFn, createAdminServerFn, deleteAdminServerFn } from "@/lib/api.functions";
import { changePasswordServerFn } from "@/lib/auth.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/admins")({
  component: AdminsPage,
});

function AdminsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: admins, isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: async () => {
      const rows = await getAdminsServerFn();
      return rows ?? [];
    },
  });

  const createAdmin = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome");
      if (!email.trim()) throw new Error("Informe o e-mail");
      if (password.length < 8) throw new Error("A senha precisa ter no mínimo 8 caracteres");

      await createAdminServerFn({
        data: {
          name: name.trim(),
          email: email.trim(),
          password,
        },
      });
    },
    onSuccess: () => {
      toast.success("Novo administrador adicionado com sucesso!");
      setName("");
      setEmail("");
      setPassword("");
      void qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAdmin = useMutation({
    mutationFn: async (id: string) => {
      await deleteAdminServerFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Administrador removido");
      void qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAdmin.mutate();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Shield className="size-6 text-primary" /> Gerenciamento de Administradores
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre novos administradores com acesso total ao painel do Matrix Online ou gerencie os
          acessos existentes.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* LISTA DE ADMINS */}
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Administradores Ativos ({admins?.length ?? 0})
          </h2>

          <div className="mt-4 divide-y divide-border/60">
            {(admins ?? []).map((adm) => {
              const isMe = adm.id === user?.id || adm.email === user?.email;
              return (
                <div key={adm.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground text-sm">{adm.name}</p>
                      {isMe && (
                        <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                          Você
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{adm.email}</p>
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                      Criado em {new Date(adm.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  {!isMe && (admins?.length ?? 0) > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={removeAdmin.isPending}
                      onClick={() => {
                        if (confirm(`Deseja realmente remover o administrador ${adm.name}?`)) {
                          removeAdmin.mutate(adm.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              );
            })}

            {admins?.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {isLoading ? "Carregando administradores..." : "Nenhum administrador encontrado."}
              </p>
            )}
          </div>
        </div>

        {/* FORMULÁRIO DE ADICIONAR NOVO ADMIN */}
        <div className="h-fit space-y-8">
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
              <UserPlus className="size-5 text-primary" /> Novo Administrador
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              O novo usuário terá permissão para gerenciar vendas, estoques e configurações.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="adm-name" className="text-xs">
                  Nome Completo
                </Label>
                <Input
                  id="adm-name"
                  placeholder="Ex: João Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adm-email" className="text-xs">
                  E-mail de Login
                </Label>
                <Input
                  id="adm-email"
                  type="email"
                  placeholder="usuario@dominio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adm-pass" className="text-xs">
                  Senha de Acesso
                </Label>
                <Input
                  id="adm-pass"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <Button
                type="submit"
                className="w-full btn-pop shadow-glow"
                disabled={createAdmin.isPending}
              >
                <UserPlus className="mr-1.5 size-4" />
                {createAdmin.isPending ? "Cadastrando..." : "Adicionar Administrador"}
              </Button>
            </form>
          </div>

          <ChangePasswordCard />
        </div>
      </div>
    </div>
  );
}

/** Troca da própria senha — importante para tirar do ar qualquer senha provisória. */
function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const change = useMutation({
    mutationFn: async () => {
      if (next.length < 8) throw new Error("A nova senha precisa ter ao menos 8 caracteres");
      if (next !== confirm) throw new Error("A confirmação não confere com a nova senha");
      await changePasswordServerFn({ data: { current_password: current, new_password: next } });
    },
    onSuccess: () => {
      toast.success("Senha atualizada");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
        <KeyRound className="size-5 text-primary" /> Minha senha
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Ao trocar a senha, todas as outras sessões desta conta são encerradas.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
        className="mt-5 space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="pw-current" className="text-xs">
            Senha atual
          </Label>
          <Input
            id="pw-current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new" className="text-xs">
            Nova senha
          </Label>
          <Input
            id="pw-new"
            type="password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm" className="text-xs">
            Confirme a nova senha
          </Label>
          <Input
            id="pw-confirm"
            type="password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={change.isPending}>
          <KeyRound className="mr-1.5 size-4" />
          {change.isPending ? "Salvando..." : "Trocar minha senha"}
        </Button>
      </form>
    </div>
  );
}
