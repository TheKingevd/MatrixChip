import crypto from "node:crypto";
import { deleteCookie, getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { db } from "./db";

/**
 * Sessão do Matrix Online.
 *
 * O token vive em um cookie httpOnly (nunca em localStorage), então JavaScript
 * injetado na página não consegue roubá-lo. Toda server function sensível chama
 * requireUser/requireAdmin — o cliente não decide quem ele é.
 */

export const SESSION_COOKIE = "matrix_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "seller" | "customer";
};

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

type SessionRow = SessionUser & { expires_at: string };

function insertSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  // Limpa sessões vencidas de todas as contas a cada login.
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(token, userId, expiresAt, now);

  return token;
}

/** Cria a sessão e grava o cookie httpOnly na resposta. */
export function createSession(userId: string): void {
  const token = insertSession(userId);
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** Encerra a sessão atual (inclusive no banco). */
export function destroySession(): void {
  const token = getCookie(SESSION_COOKIE);
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

/** Usuário da sessão atual, ou null. */
export function getSessionUser(): SessionUser | null {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as SessionRow | undefined;

  if (!row) return null;

  const expiresAtMs = new Date(row.expires_at).getTime();
  if (expiresAtMs < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  // Mantém a sessão viva enquanto o usuário continua usando o sistema.
  // O cookie continua sendo httpOnly e o token continua apenas no servidor.
  if (expiresAtMs - Date.now() < SESSION_REFRESH_THRESHOLD_MS) {
    const refreshedExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    db.prepare("UPDATE sessions SET expires_at = ? WHERE token = ?").run(
      refreshedExpiresAt,
      token,
    );
    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env["NODE_ENV"] === "production",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
  }

  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

/** Exige sessão válida (admin ou vendedor). */
export function requireUser(): SessionUser {
  const user = getSessionUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  return user;
}

/** Exige sessão de administrador. */
export function requireAdmin(): SessionUser {
  const user = requireUser();
  if (user.role !== "admin") throw new Error("Acesso restrito a administradores.");
  return user;
}

// ==========================================
// LIMITE DE TENTATIVAS DE LOGIN
// ==========================================
// Evita força bruta em um único processo Node. Se o app for escalado para
// várias instâncias, troque por um contador compartilhado (Redis/Postgres).

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

/**
 * Chave do limite de tentativas: IP + e-mail.
 * xForwardedFor só é considerado quando a aplicação roda atrás de um proxy
 * confiável (nginx, Caddy, Cloudflare) — sem proxy, o header é forjável.
 */
export function loginKey(email: string): string {
  let ip = "local";
  try {
    ip = getRequestIP({ xForwardedFor: process.env["TRUST_PROXY"] === "1" }) ?? "local";
  } catch {
    // Fora de um request (ex.: script) — cai no balde "local".
  }
  return `${ip}|${email.trim().toLowerCase()}`;
}

export function assertLoginAllowed(key: string): void {
  const entry = attempts.get(key);
  if (!entry) return;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return;
  }
  if (entry.count >= MAX_ATTEMPTS) {
    const minutes = Math.ceil((WINDOW_MS - (Date.now() - entry.first)) / 60_000);
    throw new Error(`Muitas tentativas de login. Tente novamente em ${minutes} minuto(s).`);
  }
}

export function registerLoginFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
