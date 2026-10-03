import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "seller" | "customer";
};

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido"),
  password: z.string().min(4, "Informe a senha"),
});

/**
 * Autenticação.
 *
 * O token da sessão vai em cookie httpOnly (veja src/server/auth.ts) — ele não
 * é devolvido ao JavaScript da página nem aceito como parâmetro do cliente.
 */
export const loginServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const { db, verifyPassword } = await import("@/server/db");
    const auth = await import("@/server/auth");

    const key = auth.loginKey(data.email);
    auth.assertLoginAllowed(key);

    const user = db
      .prepare(
        "SELECT id, email, password_hash, name, role FROM users WHERE LOWER(email) = LOWER(?)",
      )
      .get(data.email) as
      | {
          id: string;
          email: string;
          password_hash: string;
          name: string;
          role: "admin" | "seller" | "customer";
        }
      | undefined;

    if (!user || !verifyPassword(data.password, user.password_hash)) {
      auth.registerLoginFailure(key);
      throw new Error("E-mail ou senha incorretos.");
    }

    auth.clearLoginAttempts(key);
    auth.createSession(user.id);

    return {
      ok: true as const,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      } satisfies SessionUser,
    };
  });

export const logoutServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("@/server/auth");
  destroySession();
  return { ok: true as const };
});

/** Usuário da sessão atual (lê o cookie) ou null. */
export const meServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/server/auth");
  return getSessionUser();
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Informe a senha atual"),
  new_password: z
    .string()
    .min(8, "A nova senha precisa ter ao menos 8 caracteres")
    .max(100, "Senha muito longa"),
});

/** Troca a própria senha — disponível para admin e vendedor logados. */
export const changePasswordServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => changePasswordSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await import("@/server/auth");
    const { db, hashPassword, verifyPassword } = await import("@/server/db");

    const session = auth.requireUser();

    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(session.id) as
      { password_hash: string } | undefined;

    if (!row || !verifyPassword(data.current_password, row.password_hash)) {
      throw new Error("A senha atual está incorreta.");
    }
    if (data.current_password === data.new_password) {
      throw new Error("A nova senha precisa ser diferente da atual.");
    }

    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hashPassword(data.new_password),
      session.id,
    );

    // Derruba as outras sessões deste usuário (inclusive a atual, que é recriada).
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(session.id);
    auth.createSession(session.id);

    return { ok: true as const };
  });
