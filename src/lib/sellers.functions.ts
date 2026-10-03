import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";

const schema = z.object({
  sellerId: z.string(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(100),
});

/** Cria (ou atualiza a senha de) o login de um vendedor no SQLite local. */
export const upsertSellerLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();

    const { db, hashPassword } = await import("@/server/db");
    const sellerStmt = db.prepare("SELECT id, user_id FROM sellers WHERE id = ?");
    const seller = sellerStmt.get(data.sellerId) as
      { id: string; user_id: string | null } | undefined;
    if (!seller) throw new Error("Vendedor não encontrado.");

    let userId = seller.user_id;

    if (userId) {
      // Atualiza usuário existente
      db.prepare("UPDATE users SET email = ?, password_hash = ? WHERE id = ?").run(
        data.email,
        hashPassword(data.password),
        userId,
      );
    } else {
      // Cria novo usuário vendedor
      userId = crypto.randomUUID();
      const sellerName = data.email.split("@")[0] || "Vendedor";
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO users (id, email, password_hash, name, role, created_at)
        VALUES (?, ?, ?, ?, 'seller', ?)
      `,
      ).run(userId, data.email, hashPassword(data.password), sellerName, now);
    }

    db.prepare("UPDATE sellers SET user_id = ?, email = ? WHERE id = ?").run(
      userId,
      data.email,
      data.sellerId,
    );

    return { ok: true as const, email: data.email };
  });

/** Remove o login de um vendedor (o cadastro e o histórico continuam). */
export const removeSellerLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ sellerId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();

    const { db } = await import("@/server/db");
    const sellerStmt = db.prepare("SELECT user_id FROM sellers WHERE id = ?");
    const seller = sellerStmt.get(data.sellerId) as { user_id: string | null } | undefined;

    if (seller?.user_id) {
      db.prepare("DELETE FROM users WHERE id = ?").run(seller.user_id);
    }
    db.prepare("UPDATE sellers SET user_id = null, email = null WHERE id = ?").run(data.sellerId);

    return { ok: true as const };
  });
