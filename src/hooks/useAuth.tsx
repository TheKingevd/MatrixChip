import { useEffect, useState, useCallback } from "react";
import { meServerFn, logoutServerFn, type SessionUser } from "@/lib/auth.functions";

/**
 * Sessão no cliente.
 *
 * Não há token em localStorage: o cookie httpOnly é enviado automaticamente em
 * cada requisição, então aqui só perguntamos ao servidor quem está logado.
 */
export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const currentUser = await meServerFn();
      setUser(currentUser ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const signOut = async () => {
    try {
      await logoutServerFn();
    } catch {
      // ignora: o cookie é limpo no melhor esforço
    }
    setUser(null);
  };

  /** Chamado após o login — a sessão em si já foi criada no servidor. */
  const setAuthData = (newUser: SessionUser) => {
    setUser(newUser);
  };

  return {
    session: user ? { user } : null,
    user,
    isAdmin: user?.role === "admin",
    loading,
    signOut,
    setAuthData,
    reload: checkAuth,
  };
}
