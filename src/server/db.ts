import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadEnv } from "./env";

loadEnv();

const DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "matrix.db");
const db = new DatabaseSync(DB_PATH);

// Executa WAL mode para melhor concorrência
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Criar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS country_overrides (
    code TEXT PRIMARY KEY,
    price REAL,
    stock INTEGER,
    type TEXT,
    esim INTEGER,
    chip INTEGER,
    active INTEGER DEFAULT 1,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    percent REAL NOT NULL,
    country_code TEXT,
    number_type TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sellers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    commission_percent REAL NOT NULL DEFAULT 10,
    active INTEGER NOT NULL DEFAULT 1,
    user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    country_code TEXT NOT NULL,
    country_name TEXT NOT NULL,
    dial TEXT NOT NULL,
    ddd TEXT,
    assigned_number TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_cpf TEXT,
    customer_email TEXT,
    cep TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    number_type TEXT NOT NULL,
    delivery TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    shipping_cost REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    coupon_code TEXT,
    coupon_percent REAL,
    payment_method TEXT NOT NULL,
    pix_status TEXT NOT NULL DEFAULT 'aguardando',
    pix_confirmed_at TEXT,
    receipt_path TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    tracking_code TEXT,
    notes TEXT,
    seller_id TEXT,
    created_by TEXT,
    customer_id TEXT,
    mp_payment_id TEXT,
    qr_code TEXT,
    qr_code_base64 TEXT,
    payment_provider TEXT,
    payment_external_id TEXT,
    pix_payload TEXT,
    pix_expires_at TEXT,
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS seller_payouts (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    paid_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
  );
`);

/**
 * SQLite não suporta "ADD COLUMN IF NOT EXISTS", então conferimos o schema
 * antes de alterar — mantém bancos já em uso funcionando após uma atualização.
 */
function addColumnIfMissing(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// Vínculo do pedido com a conta do cliente (usado pelo painel do cliente).
addColumnIfMissing("sales", "customer_id", "TEXT");
addColumnIfMissing("sales", "payment_provider", "TEXT");
addColumnIfMissing("sales", "payment_external_id", "TEXT");
addColumnIfMissing("sales", "pix_payload", "TEXT");
addColumnIfMissing("sales", "pix_expires_at", "TEXT");

// Funções utilitárias de hash de senha
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;
    const computed = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
  } catch {
    return false;
  }
}

// Seed inicial se não existir nenhum usuário.
// As credenciais do primeiro admin vêm do ambiente (.env), nunca do código:
//   ADMIN_EMAIL=voce@seudominio.com
//   ADMIN_PASSWORD=uma-senha-forte
const countStmt = db.prepare("SELECT COUNT(*) as count FROM users;");
const countResult = countStmt.get() as { count: number };
if (countResult.count === 0) {
  const adminEmail = process.env["ADMIN_EMAIL"]?.trim();
  const adminPassword = process.env["ADMIN_PASSWORD"];

  if (adminEmail && adminPassword && adminPassword.length >= 8) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `);
    insertUser.run(
      crypto.randomUUID(),
      adminEmail,
      hashPassword(adminPassword),
      "Administrador Matrix Online",
      "admin",
      new Date().toISOString(),
    );
    console.info(`[matrix] Administrador inicial criado para ${adminEmail}.`);
  } else {
    console.warn(
      "[matrix] Nenhum administrador foi criado. Defina ADMIN_EMAIL e ADMIN_PASSWORD " +
        "(senha com 8+ caracteres) no .env, apague data/matrix.db e reinicie para criar o primeiro acesso.",
    );
  }

  // Configurações padrão
  const insertSetting = db.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?);
  `);
  const now = new Date().toISOString();
  const defaultSettings: [string, string][] = [
    ["brand_name", "Matrix Online"],
    ["support_phone", "5545991226904"],
    ["hero_note", "Chips Físicos com Entrega Rápida em todo o Brasil!"],
    ["ticker_enabled", "on"],
    ["ticker_interval", "15"],
    ["payment_provider", "asaas"],
    ["payment_minimum", "1"],
  ];

  for (const [k, v] of defaultSettings) {
    insertSetting.run(k, v, now);
  }

  // Cupons padrão
  const insertCoupon = db.prepare(`
    INSERT OR IGNORE INTO coupons (id, code, percent, active, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?);
  `);
  insertCoupon.run(crypto.randomUUID(), "MATRIX10", 10, now, now);
  insertCoupon.run(crypto.randomUUID(), "BEMVINDO", 15, now, now);
}

export { db };
