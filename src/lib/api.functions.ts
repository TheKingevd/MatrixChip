import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";

// ==========================================
// CONFIGURAÇÕES (leitura pública, escrita só admin)
// ==========================================

const PRIVATE_SETTING_KEYS = new Set([
  "payment_provider",
  "asaas_access_token",
  "asaas_api_url",
  "asaas_webhook_token",
  "mercadopago_access_token",
  "mercadopago_webhook_secret",
  "public_app_url",
]);

async function readSettings(includePrivate = false) {
  const { db } = await import("@/server/db");
  const rows = db.prepare("SELECT key, value FROM app_settings").all() as {
    key: string;
    value: string;
  }[];
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (!includePrivate && PRIVATE_SETTING_KEYS.has(row.key)) continue;
    map[row.key] = row.value;
  }
  return map;
}

export const getSettingsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return readSettings(false);
});

export const getAdminSettingsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/server/auth");
  requireAdmin();
  const settings = await readSettings(false);
  const { db } = await import("@/server/db");
  const secretKeys = ["asaas_access_token", "mercadopago_access_token"];
  for (const key of secretKeys) {
    const row = db.prepare("SELECT 1 FROM app_settings WHERE key = ? AND length(trim(value)) > 0").get(key);
    settings[key] = row ? "__CONFIGURADO__" : "";
  }
  return settings;
});

export const testPaymentGatewayServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ provider: z.enum(["asaas", "mercadopago"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();

    const settings = await readSettings(true);
    const selected = data.provider;
    const token =
      selected === "asaas"
        ? settings["asaas_access_token"]?.trim()
        : settings["mercadopago_access_token"]?.trim();

    if (!token) throw new Error(`Token do ${selected === "asaas" ? "Asaas" : "Mercado Pago"} não configurado.`);

    if (selected === "asaas") {
      const base = (settings["asaas_api_url"] || "https://api.asaas.com").replace(/\/$/, "");
      const response = await fetch(`${base}/v3/myAccount`, {
        headers: { accept: "application/json", access_token: token },
      });
      if (!response.ok) throw new Error(`Asaas recusou o token (HTTP ${response.status}).`);
    } else {
      const response = await fetch("https://api.mercadopago.com/v1/users/me", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Mercado Pago recusou o token (HTTP ${response.status}).`);
    }

    return { ok: true };
  });

export const updateSettingsServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .array(z.object({ key: z.string().max(60), value: z.string().max(2000) }))
      .max(100)
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();

    const { db } = await import("@/server/db");
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `);
    for (const item of data) {
      stmt.run(item.key, item.value, now);
    }
    return { ok: true };
  });

// ==========================================
// OVERRIDES DO CATÁLOGO DE CHIPS
// ==========================================

export type CountryOverrideRow = {
  code: string;
  price: number | null;
  stock: number | null;
  type: string | null;
  esim: boolean;
  chip: boolean;
  active: boolean;
};

export const getCountryOverridesServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("@/server/db");
  const rows = db
    .prepare("SELECT code, price, stock, type, esim, chip, active FROM country_overrides")
    .all() as {
    code: string;
    price: number | null;
    stock: number | null;
    type: string | null;
    esim: number | null;
    chip: number | null;
    active: number;
  }[];

  const map: Record<string, CountryOverrideRow> = {};
  for (const r of rows) {
    map[r.code] = {
      code: r.code,
      price: r.price,
      stock: r.stock,
      type: r.type,
      esim: r.esim === 1,
      chip: r.chip === 1,
      active: r.active === 1,
    };
  }
  return map;
});

export const upsertCountryOverrideServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        code: z.string().trim().min(2).max(4),
        price: z.number().min(0).max(1_000_000).nullable().optional(),
        stock: z.number().int().min(0).max(1_000_000).nullable().optional(),
        type: z.string().max(20).nullable().optional(),
        esim: z.boolean().nullable().optional(),
        chip: z.boolean().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();

    const { db } = await import("@/server/db");
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO country_overrides (code, price, stock, type, esim, chip, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.code,
      data.price ?? null,
      data.stock ?? null,
      data.type ?? null,
      data.esim ? 1 : 0,
      data.chip !== false ? 1 : 0,
      data.active !== false ? 1 : 0,
      now,
    );
    return { ok: true };
  });

// ==========================================
// CUPONS
// ==========================================

export const getCouponsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("@/server/db");
  const rows = db
    .prepare(
      `
    SELECT id, code, percent, country_code, number_type, active, expires_at
    FROM coupons
    ORDER BY created_at DESC
  `,
    )
    .all() as {
    id: string;
    code: string;
    percent: number;
    country_code: string | null;
    number_type: string | null;
    active: number;
    expires_at: string | null;
  }[];

  return rows.map((r) => ({
    ...r,
    active: r.active === 1,
  }));
});

export const saveCouponServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        code: z.string().trim().min(2).max(40),
        percent: z.number().min(1).max(100),
        country_code: z.string().max(4).nullable().optional(),
        number_type: z.string().max(20).nullable().optional(),
        active: z.boolean().optional(),
        expires_at: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();

    const { db } = await import("@/server/db");
    const now = new Date().toISOString();
    const id = data.id || crypto.randomUUID();
    const wasExisting = Boolean(
      data.id && db.prepare("SELECT 1 FROM coupons WHERE id = ?").get(data.id),
    );

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO coupons (id, code, percent, country_code, number_type, active, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM coupons WHERE id = ?), ?), ?)
    `);

    stmt.run(
      id,
      data.code.toUpperCase(),
      data.percent,
      data.country_code || null,
      data.number_type || null,
      data.active !== false ? 1 : 0,
      data.expires_at || null,
      id,
      now,
      now,
    );

    if (!wasExisting) {
      const { sendAdminPush } = await import("@/server/push");
      await sendAdminPush({
        title: "Novo cupom criado",
        body: `Cupom ${data.code.toUpperCase()} criado com ${data.percent}% de desconto.`,
        url: "/admin/cupons",
        tag: `coupon-created-${id}`,
      }).catch((error) => console.error("[matrix] push de cupom:", error));
    }

    return { ok: true, id };
  });

export const deleteCouponServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();

    const { db } = await import("@/server/db");
    db.prepare("DELETE FROM coupons WHERE id = ?").run(data.id);
    return { ok: true };
  });

// ==========================================
// PEDIDOS DE CHIP FÍSICO / VENDAS
// ==========================================

/** Projeção pública do pedido: sem CPF, e-mail, comprovante ou dados internos. */
export type PublicOrder = {
  id: string;
  created_at: string;
  country_code: string;
  country_name: string;
  dial: string;
  ddd: string | null;
  assigned_number: string | null;
  customer_name: string;
  customer_phone: string | null;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  number_type: string;
  delivery: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  status: string;
  tracking_code: string | null;
  pix_status: string;
  pix_confirmed_at: string | null;
};

const PUBLIC_ORDER_COLUMNS = `
  id, created_at, country_code, country_name, dial, ddd, assigned_number,
  customer_name, customer_phone, cep, street, number, complement, neighborhood,
  city, state, number_type, delivery, quantity, unit_price, discount, total,
  status, tracking_code, pix_status, pix_confirmed_at
`;

/**
 * Campos de preço (unit_price, discount, total), status e vendedor só são
 * aceitos de administradores (PDV). No checkout do site tudo é recalculado
 * aqui a partir do catálogo e da tabela de cupons.
 */
const createOrderSchema = z.object({
  country_code: z.string().trim().min(2).max(4),
  ddd: z.string().trim().max(4).nullable().optional(),
  assigned_number: z.string().trim().max(40).nullable().optional(),
  customer_name: z.string().trim().min(3, "Informe seu nome completo").max(120),
  customer_phone: z.string().trim().max(30).optional(),
  customer_cpf: z.string().trim().max(30).optional(),
  customer_email: z
    .string()
    .trim()
    .email("Informe um e-mail válido")
    .max(160)
    .optional()
    .or(z.literal("")),
  account_secret: z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(100).optional(),
  cep: z.string().trim().max(12).optional(),
  street: z.string().trim().max(160).optional(),
  number: z.string().trim().max(20).optional(),
  complement: z.string().trim().max(120).optional(),
  neighborhood: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(4).optional(),
  number_type: z.enum(["whatsapp", "business", "ambos"]).default("ambos"),
  delivery: z.enum(["chip", "esim", "ambos"]).default("chip"),
  quantity: z.number().int().min(1).max(50).default(1),
  coupon_code: z.string().trim().max(40).nullable().optional(),
  // Somente PDV (admin):
  unit_price: z.number().min(0).max(1_000_000).optional(),
  discount: z.number().min(0).max(1_000_000).optional(),
  coupon_percent: z.number().min(0).max(100).nullable().optional(),
  payment_method: z.string().trim().max(20).optional(),
  status: z.string().trim().max(20).optional(),
  seller_id: z.string().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

function resolveCoupon(
  db: import("node:sqlite").DatabaseSync,
  rawCode: string,
  countryCode: string,
  numberType: string,
) {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;

  const rows = db
    .prepare(
      `SELECT code, percent, country_code, number_type, active, expires_at
       FROM coupons WHERE UPPER(code) = ?`,
    )
    .all(code) as {
    code: string;
    percent: number;
    country_code: string | null;
    number_type: string | null;
    active: number;
    expires_at: string | null;
  }[];

  const valid = rows.filter(
    (c) =>
      c.active === 1 &&
      (!c.expires_at || new Date(c.expires_at).getTime() >= Date.now()) &&
      (!c.country_code || c.country_code === countryCode) &&
      (!c.number_type || c.number_type === numberType),
  );

  if (valid.length === 0) return null;
  return valid.reduce((best, c) => (c.percent > best.percent ? c : best), valid[0]!);
}

function newOrderId(db: import("node:sqlite").DatabaseSync): string {
  for (let i = 0; i < 5; i++) {
    const id = `MTX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const exists = db.prepare("SELECT 1 FROM sales WHERE id = ?").get(id);
    if (!exists) return id;
  }
  throw new Error("Não foi possível gerar o número do pedido. Tente novamente.");
}

export const createOrderServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { db } = await import("@/server/db");
    const { getSessionUser } = await import("@/server/auth");
    const { countries } = await import("@/data/countries");

    let session = getSessionUser();
    const isAdmin = session?.role === "admin";

    if (!isAdmin) {
      if (!data.customer_email) throw new Error("Informe seu e-mail para criar sua conta.");


      const { hashPassword, verifyPassword } = await import("@/server/db");
      const existing = db
        .prepare("SELECT id, email, name, password_hash, role FROM users WHERE LOWER(email) = LOWER(?)")
        .get(data.customer_email) as
        | { id: string; password_hash: string; role: string }
        | undefined;

      if (existing) {
        if (existing.role !== "customer") {
          throw new Error(
            "Este e-mail pertence a uma conta administrativa. Use outro e-mail para criar sua conta de cliente.",
          );
        }
        if (!data.account_secret) {
          throw new Error("Este e-mail já possui uma conta. Informe a senha para continuar.");
        }
        if (!verifyPassword(data.account_secret, existing.password_hash)) {
          throw new Error("Senha incorreta para esta conta de cliente.");
        }
        session = { id: existing.id, email: existing.email, name: existing.name, role: "customer" };
      } else {
        if (!data.account_secret) {
          throw new Error("Crie uma senha com pelo menos 8 caracteres para sua conta.");
        }

        const customerId = crypto.randomUUID();
        db.prepare(
          "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, 'customer', ?)",
        ).run(
          customerId,
          data.customer_email,
          hashPassword(data.account_secret),
          data.customer_name,
          new Date().toISOString(),
        );
        session = { id: customerId, email: data.customer_email, name: data.customer_name, role: "customer" };
      }

      const { createSession } = await import("@/server/auth");
      createSession(session.id);
    }

    const country = countries.find((c) => c.code === data.country_code);
    if (!country) throw new Error("Chip indisponível para este país.");

    const override = db
      .prepare("SELECT price, active FROM country_overrides WHERE code = ?")
      .get(country.code) as { price: number | null; active: number } | undefined;

    if (!isAdmin && override?.active === 0) {
      throw new Error("Este chip está temporariamente indisponível.");
    }

    // Preço sempre vem do catálogo/banco, nunca do navegador.
    const catalogPrice = override?.price != null ? Number(override.price) : country.price;

    const quantity = data.quantity;
    const unitPrice = isAdmin && data.unit_price != null ? data.unit_price : catalogPrice;

    const subtotal = unitPrice * quantity;
    let discount: number;
    let couponCode: string | null = null;
    let couponPercent: number | null = null;

    if (isAdmin) {
      // O PDV já calcula o desconto final (manual + cupom) e é confiável.
      discount = Math.min(subtotal, data.discount ?? 0);
      couponCode = data.coupon_code || null;
      couponPercent = data.coupon_percent ?? null;
    } else {
      const coupon = data.coupon_code
        ? resolveCoupon(db, data.coupon_code, country.code, data.number_type)
        : null;
      couponCode = coupon?.code ?? null;
      couponPercent = coupon ? Number(coupon.percent) : null;
      discount = coupon ? (subtotal * Number(coupon.percent)) / 100 : 0;
    }

    const shippingCost = 0; // frete grátis
    const total = Math.max(0, subtotal - discount);

    // A comissão é definida no servidor no momento da venda.
    // O navegador nunca informa a porcentagem da comissão.
    let sellerCommissionPercent: number | null = null;
    let sellerCommissionAmount: number | null = null;
    if (isAdmin && data.seller_id) {
      const seller = db
        .prepare("SELECT id, commission_percent, active FROM sellers WHERE id = ?")
        .get(data.seller_id) as
        | { id: string; commission_percent: number; active: number }
        | undefined;

      if (!seller) throw new Error("Vendedor não encontrado.");
      if (seller.active !== 1) throw new Error("O vendedor selecionado está inativo.");

      sellerCommissionPercent = Number(seller.commission_percent) || 0;
      sellerCommissionAmount =
        Math.round((total * sellerCommissionPercent + Number.EPSILON) * 100) / 100;
    }

    if (!isAdmin) {
      const minimumRow = db.prepare("SELECT value FROM app_settings WHERE key = 'payment_minimum'").get() as { value?: string } | undefined;
      const minimum = Number(minimumRow?.value ?? process.env["PAYMENT_MINIMUM"] ?? 1);
      if (Number.isFinite(minimum) && total < minimum) {
        throw new Error(`O valor mínimo para pagamento é R$ ${minimum.toFixed(2).replace(".", ",")}.`);
      }
    }

    // Dados de entrega só são opcionais para o PDV.
    let cep = data.cep?.trim() ?? "";
    let street = data.street?.trim() ?? "";
    let number = data.number?.trim() ?? "";
    let neighborhood = data.neighborhood?.trim() ?? "";
    let city = data.city?.trim() ?? "";
    let state = data.state?.trim() ?? "";
    let customerCpf = data.customer_cpf?.trim() ?? "";
    let customerPhone = data.customer_phone?.trim() ?? "";

    if (!isAdmin) {
      const cpfDigits = customerCpf.replace(/\D/g, "");
      if (cpfDigits.length !== 11) throw new Error("Informe um CPF válido para emissão do envio.");
      if (customerPhone.replace(/\D/g, "").length < 10) {
        throw new Error("Informe um WhatsApp válido para contato.");
      }
      if (cep.replace(/\D/g, "").length !== 8) throw new Error("Informe um CEP válido.");
      if (!street || !number || !neighborhood || !city || !state) {
        throw new Error(
          "Preencha o endereço de entrega completo (rua, número, bairro, cidade e UF).",
        );
      }
      if (state.length !== 2) throw new Error("Informe a UF com 2 letras.");
    } else {
      // Preenche os campos que o PDV não coleta.
      cep = cep || "00000-000";
      street = street || "Venda Balcão PDV";
      number = number || "S/N";
      neighborhood = neighborhood || "Balcão";
      city = city || "PDV";
      state = state || "BR";
      customerCpf = customerCpf || "PDV-BALCAO";
      customerPhone = customerPhone || "Não informado";
    }

    const orderId = newOrderId(db);
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO sales (
        id, created_at, country_code, country_name, dial, ddd, assigned_number,
        customer_name, customer_phone, customer_cpf, customer_email,
        cep, street, number, complement, neighborhood, city, state,
        number_type, delivery, quantity, unit_price, discount, shipping_cost, total,
        coupon_code, coupon_percent, payment_method, pix_status, status, notes,
        seller_id, seller_commission_percent, seller_commission_amount, customer_id
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, 'aguardando', ?, ?, ?, ?, ?, ?
      )
    `);

    stmt.run(
      orderId,
      now,
      country.code,
      country.name,
      country.dial,
      data.ddd || null,
      data.assigned_number || null,
      data.customer_name,
      customerPhone,
      customerCpf,
      data.customer_email || null,
      cep,
      street,
      number,
      data.complement?.trim() || null,
      neighborhood,
      city,
      state,
      data.number_type,
      data.delivery,
      quantity,
      unitPrice,
      discount,
      shippingCost,
      total,
      couponCode,
      couponPercent,
      isAdmin ? data.payment_method || "pix" : "pix",
      isAdmin ? data.status || "pendente" : "pendente",
      isAdmin ? data.notes || null : null,
      isAdmin ? data.seller_id || null : null,
      sellerCommissionPercent,
      sellerCommissionAmount,
      session?.id ?? null,
    );

    // Venda feita pelo PDV/admin não cria cobrança automática.
    // Somente o checkout público do cliente cria uma cobrança no gateway.
    if (isAdmin) {
      return {
        ok: true,
        orderId,
        total,
        unitPrice,
        discount,
        customerName: data.customer_name,
        payment: null,
      };
    }

    try {
      const { createPixCharge } = await import("@/server/payments");
      const pixCharge = await createPixCharge({
        orderId,
        name: data.customer_name,
        email: data.customer_email || "",
        cpf: customerCpf,
        phone: customerPhone,
        total,
      });

      db.prepare(
        `UPDATE sales
         SET payment_provider = ?, payment_external_id = ?, qr_code = ?, qr_code_base64 = ?,
             pix_payload = ?, pix_expires_at = ?, status = 'pendente', pix_status = 'aguardando'
         WHERE id = ?`,
      ).run(
        pixCharge.provider,
        pixCharge.externalId,
        pixCharge.qrCode,
        pixCharge.qrCodeBase64,
        pixCharge.qrCode,
        pixCharge.expiresAt || null,
        orderId,
      );

      const { sendAdminPush } = await import("@/server/push");
      await sendAdminPush({
        title: "Novo pedido de chip",
        body: `${data.customer_name} fez o pedido ${orderId} no valor de R$ ${total.toFixed(2).replace(".", ",")}.`,
        url: "/admin/historico",
        tag: `sale-created-${orderId}`,
      }).catch((error) => console.error("[matrix] push de novo pedido:", error));

      if (couponCode) {
        db.prepare(
          `INSERT INTO coupon_redemptions
           (id, coupon_code, sale_id, customer_name, customer_email, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          crypto.randomUUID(),
          couponCode,
          orderId,
          data.customer_name,
          data.customer_email || null,
          now,
        );

        await sendAdminPush({
          title: "Cupom resgatado",
          body: `${data.customer_name} resgatou o cupom ${couponCode} no pedido ${orderId}.`,
          url: "/admin/cupons",
          tag: `coupon-redeemed-${orderId}`,
        }).catch((error) => console.error("[matrix] push de cupom resgatado:", error));
      }

      return {
        ok: true,
        orderId,
        total,
        unitPrice,
        discount,
        customerName: data.customer_name,
        payment: pixCharge,
      };
    } catch (error) {
      db.prepare("UPDATE sales SET status = 'erro_pagamento' WHERE id = ?").run(orderId);
      throw error;
    }
  });

/**
 * Acompanhamento do pedido pelo cliente.
 *
 * O ID aleatório (12 caracteres hex) é o segredo do link: sem ele não dá para
 * enumerar pedidos. Mesmo assim devolvemos só a projeção pública.
 */

export const getCustomerOrdersServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/server/auth");
  const user = requireUser();
  if (user.role !== "customer") throw new Error("Acesso restrito à conta do cliente.");

  const { db } = await import("@/server/db");
  return db.prepare(
    `SELECT id, created_at, country_code, country_name, dial, ddd, assigned_number,
            customer_name, customer_phone, cep, street, number, complement, neighborhood,
            city, state, number_type, delivery, quantity, unit_price, discount, total,
            status, tracking_code, pix_status, pix_confirmed_at, payment_provider,
            payment_external_id, pix_payload, pix_expires_at
     FROM sales WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100`,
  ).all(user.id);
});

export const refreshCustomerOrderPaymentServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().trim().min(4).max(60) }).parse(data))
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/auth");
    const user = requireUser();
    if (user.role !== "customer") throw new Error("Acesso restrito à conta do cliente.");

    const { db } = await import("@/server/db");
    const order = db.prepare(
      "SELECT id, payment_provider, payment_external_id, pix_status, status FROM sales WHERE id = ? AND customer_id = ?",
    ).get(data.id) as
      | { id: string; payment_provider: "asaas" | "mercadopago" | null; payment_external_id: string | null; pix_status: string; status: string }
      | undefined;

    if (!order) throw new Error("Pedido não encontrado.");
    if (!order.payment_provider || !order.payment_external_id) {
      return { ok: true, status: order.pix_status, paid: order.pix_status === "confirmado" };
    }

    const { getPixStatus } = await import("@/server/payments");
    const result = await getPixStatus(order.payment_provider, order.payment_external_id);

    if (result.paid) {
      const wasConfirmed = order.pix_status === "confirmado";
      db.prepare(
        "UPDATE sales SET pix_status = 'confirmado', pix_confirmed_at = COALESCE(pix_confirmed_at, ?), status = CASE WHEN status IN ('pendente','erro_pagamento') THEN 'pago' ELSE status END WHERE id = ?",
      ).run(new Date().toISOString(), order.id);

      if (!wasConfirmed) {
        const { sendAdminPush } = await import("@/server/push");
        await sendAdminPush({
          title: "Pagamento confirmado",
          body: `Pedido ${order.id} pago pelo cliente.`,
          url: "/admin/historico",
          tag: `payment-confirmed-${order.id}`,
        }).catch((error) => console.error("[matrix] push de pagamento:", error));
      }
    }

    return { ok: true, status: result.status, paid: result.paid };
  });

export const getOrderServerFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ id: z.string().trim().min(4).max(60) }).parse(data))
  .handler(async ({ data }) => {
    const { db } = await import("@/server/db");
    const order = db
      .prepare(`SELECT ${PUBLIC_ORDER_COLUMNS} FROM sales WHERE id = ?`)
      .get(data.id) as PublicOrder | undefined;
    return order ?? null;
  });

/** Somente administradores: lista completa das vendas. */
export const getSalesServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/server/auth");
  requireAdmin();

  const { db } = await import("@/server/db");
  return db.prepare("SELECT * FROM sales ORDER BY created_at DESC LIMIT 1000").all();
});

export const updateSaleStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        id: z.string(),
        status: z.string().trim().max(20).optional(),
        tracking_code: z.string().trim().max(40).nullable().optional(),
        assigned_number: z.string().trim().max(40).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();

    const { db } = await import("@/server/db");
    if (data.status !== undefined) {
      const current = db
        .prepare(
          "SELECT seller_id, status, pix_status FROM sales WHERE id = ?",
        )
        .get(data.id) as
        | { seller_id: string | null; status: string; pix_status: string }
        | undefined;

      if (!current) throw new Error("Venda não encontrada.");

      if (["pago", "paid"].includes(data.status) && current.pix_status !== "confirmado") {
        // O PDV registra vendas manuais diretamente como pagas. Para alterações
        // posteriores, pagamento online só pode ser confirmado pelo gateway.
        if (current.status !== "pago") {
          throw new Error("Pagamento só pode ser confirmado automaticamente pelo gateway.");
        }
      }

      if (current.seller_id && data.status === "cancelada") {
        const { sellerFinancials } = await import("@/lib/api.functions");
        // Não dependemos de valores enviados pelo navegador. Se o cancelamento
        // faria os repasses já pagos ultrapassarem a comissão disponível, bloqueamos.
        const financials = sellerFinancials(db, current.seller_id);
        const currentSale = db
          .prepare("SELECT seller_commission_amount, total, seller_commission_percent FROM sales WHERE id = ?")
          .get(data.id) as
          | { seller_commission_amount: number | null; total: number; seller_commission_percent: number | null }
          | undefined;
        const saleCommission = currentSale?.seller_commission_amount ??
          Math.round((Number(currentSale?.total || 0) * Number(currentSale?.seller_commission_percent || 0) + Number.EPSILON) * 100) / 100;
        const wouldBeBalance = financials.balance - (current.status === "pago" || current.status === "processando" || current.status === "entregue" ? saleCommission : 0);
        if (wouldBeBalance < -0.0001) {
          throw new Error("Venda não pode ser cancelada porque parte da comissão já foi repassada.");
        }
      }

      db.prepare("UPDATE sales SET status = ? WHERE id = ?").run(data.status, data.id);
    }
    if (data.tracking_code !== undefined) {
      db.prepare("UPDATE sales SET tracking_code = ? WHERE id = ?").run(
        data.tracking_code,
        data.id,
      );
    }
    if (data.assigned_number !== undefined) {
      db.prepare("UPDATE sales SET assigned_number = ? WHERE id = ?").run(
        data.assigned_number,
        data.id,
      );
    }
    return { ok: true };
  });

export const updatePixStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();
    const { db } = await import("@/server/db");
    const order = db.prepare("SELECT payment_provider, payment_external_id, pix_status FROM sales WHERE id = ?").get(data.id) as
      | { payment_provider: "asaas" | "mercadopago" | null; payment_external_id: string | null; pix_status: string }
      | undefined;
    if (!order) throw new Error("Pedido não encontrado.");
    if (!order.payment_provider || !order.payment_external_id) throw new Error("Pedido sem cobrança automática.");
    const { getPixStatus } = await import("@/server/payments");
    const result = await getPixStatus(order.payment_provider, order.payment_external_id);
    if (result.paid) {
      const wasConfirmed = order.pix_status === "confirmado";
      db.prepare("UPDATE sales SET pix_status = 'confirmado', pix_confirmed_at = COALESCE(pix_confirmed_at, ?), status = CASE WHEN status IN ('pendente','erro_pagamento') THEN 'pago' ELSE status END WHERE id = ?").run(new Date().toISOString(), data.id);

      if (!wasConfirmed) {
        const sale = db.prepare("SELECT id, customer_name, total FROM sales WHERE id = ?").get(data.id) as
          | { id: string; customer_name: string; total: number }
          | undefined;
        if (sale) {
          const { sendAdminPush } = await import("@/server/push");
          await sendAdminPush({
            title: "Pagamento confirmado",
            body: `Pedido ${sale.id} pago por ${sale.customer_name} — R$ ${Number(sale.total).toFixed(2).replace(".", ",")}.`,
            url: "/admin/historico",
            tag: `payment-confirmed-${sale.id}`,
          }).catch((error) => console.error("[matrix] push de pagamento:", error));
        }
      }
    }
    return { ok: true, paid: result.paid, status: result.status };
  });

/** Tamanho máximo do comprovante em base64 (~5 MB de arquivo). */
const MAX_RECEIPT_CHARS = 7_000_000;

export const uploadReceiptServerFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();
    throw new Error("Comprovante manual desativado: pagamentos são confirmados somente pelo gateway.");
  });

// ==========================================
// VENDEDORES & COMISSÕES (admin)
// ==========================================

function sellerFinancials(
  db: import("node:sqlite").DatabaseSync,
  sellerId: string,
) {
  const sales = db
    .prepare(
      `SELECT
         COUNT(*) AS count,
         COALESCE(SUM(total), 0) AS revenue,
         COALESCE(
           SUM(
             COALESCE(
               seller_commission_amount,
               ROUND(total * COALESCE(seller_commission_percent, 0) / 100.0, 2)
             )
           ),
           0
         ) AS earned
       FROM sales
       WHERE seller_id = ?
         AND status IN ('pago', 'processando', 'entregue')`,
    )
    .get(sellerId) as { count: number; revenue: number; earned: number };

  const paid = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS paid FROM seller_payouts WHERE seller_id = ?")
    .get(sellerId) as { paid: number };

  const earnedCents = Math.round(Number(sales.earned || 0) * 100);
  const paidCents = Math.round(Number(paid.paid || 0) * 100);

  return {
    count: Number(sales.count || 0),
    revenue: Number(sales.revenue || 0),
    earned: earnedCents / 100,
    paid: paidCents / 100,
    balance: Math.max(0, earnedCents - paidCents) / 100,
  };
}

// ==========================================
// VENDEDORES & COMISSÕES (admin)
// ==========================================

export const getSellersServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/server/auth");
  requireAdmin();

  const { db } = await import("@/server/db");
  const rows = db.prepare("SELECT * FROM sellers ORDER BY name ASC").all() as Record<
    string,
    unknown
  >[];

  return rows.map((r) => {
    const id = String(r["id"]);
    return {
      ...r,
      active: r["active"] === 1,
      ...sellerFinancials(db, id),
    };
  });
});

export const saveSellerServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(160).nullable().optional(),
        commission_percent: z.number().min(0).max(100).default(10),
        active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();

    const { db } = await import("@/server/db");
    const now = new Date().toISOString();
    const id = data.id || crypto.randomUUID();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sellers (id, name, email, commission_percent, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM sellers WHERE id = ?), ?), ?)
    `);

    stmt.run(
      id,
      data.name,
      data.email || null,
      data.commission_percent,
      data.active !== false ? 1 : 0,
      id,
      now,
      now,
    );

    return { ok: true, id };
  });

export const deleteSellerServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();

    const { db } = await import("@/server/db");
    const seller = db.prepare("SELECT id FROM sellers WHERE id = ?").get(data.id);
    if (!seller) throw new Error("Vendedor não encontrado.");

    const history = db
      .prepare(
        "SELECT 1 FROM sales WHERE seller_id = ? LIMIT 1",
      )
      .get(data.id);
    const payouts = db
      .prepare("SELECT 1 FROM seller_payouts WHERE seller_id = ? LIMIT 1")
      .get(data.id);
    if (history || payouts) {
      throw new Error(
        "Vendedor com histórico financeiro não pode ser excluído. Desative-o para preservar a auditoria.",
      );
    }

    db.prepare("DELETE FROM sellers WHERE id = ?").run(data.id);
    return { ok: true };
  });

export const getSellerPayoutsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/server/auth");
  requireAdmin();

  const { db } = await import("@/server/db");
  return db
    .prepare(
      `SELECT p.id, p.seller_id, s.name AS seller_name, p.amount, p.note, p.paid_at, p.created_at,
              p.created_by
       FROM seller_payouts p
       JOIN sellers s ON s.id = p.seller_id
       ORDER BY p.paid_at DESC, p.created_at DESC`,
    )
    .all();
});

export const createSellerPayoutServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        seller_id: z.string().trim().min(1),
        amount: z.number().finite().min(0.01).max(1_000_000),
        note: z.string().trim().max(200).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    const admin = requireAdmin();

    const { db } = await import("@/server/db");
    const amountCents = Math.round(data.amount * 100);
    if (amountCents < 1) throw new Error("Informe um valor de saque válido.");

    db.exec("BEGIN IMMEDIATE");
    try {
      const seller = db
        .prepare("SELECT id, name FROM sellers WHERE id = ?")
        .get(data.seller_id) as { id: string; name: string } | undefined;
      if (!seller) throw new Error("Vendedor não encontrado.");

      const financials = sellerFinancials(db, seller.id);
      const balanceCents = Math.round(financials.balance * 100);

      if (amountCents > balanceCents) {
        throw new Error(
          `Saldo disponível para ${seller.name}: R$ ${financials.balance.toFixed(2).replace(".", ",")}.`,
        );
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO seller_payouts (id, seller_id, amount, note, paid_at, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        id,
        seller.id,
        amountCents / 100,
        data.note || null,
        now,
        now,
        admin.id,
      );

      db.exec("COMMIT");

      return {
        ok: true as const,
        id,
        amount: amountCents / 100,
        balanceAfter: (balanceCents - amountCents) / 100,
      };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });

export const deleteSellerPayoutServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async () => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();
    throw new Error("Repasses de comissão são registros financeiros imutáveis e não podem ser apagados.");
  });

// ==========================================
// PORTAL DO VENDEDOR (só os próprios dados)
// ==========================================

function currentSeller(db: import("node:sqlite").DatabaseSync, userId: string) {
  const seller = db
    .prepare("SELECT id, name, commission_percent, active FROM sellers WHERE user_id = ?")
    .get(userId) as
    { id: string; name: string; commission_percent: number; active: number } | undefined;
  if (!seller) throw new Error("Nenhum cadastro de vendedor está vinculado a esta conta.");
  return seller;
}

export const getMySellerServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/server/auth");
  const session = requireUser();

  const { db } = await import("@/server/db");
  if (session.role === "admin") {
    // Admin vendo o portal não tem cadastro de vendedor: devolve vazio.
    return null;
  }
  const seller = currentSeller(db, session.id);
  return { id: seller.id, name: seller.name, commission_percent: seller.commission_percent };
});

export const getMySalesServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/server/auth");
  const session = requireUser();

  const { db } = await import("@/server/db");
  if (session.role === "admin") return [];

  const seller = currentSeller(db, session.id);
  return db
    .prepare(
      `SELECT id, created_at, country_name, customer_name, total, status, seller_id
       FROM sales WHERE seller_id = ? ORDER BY created_at DESC LIMIT 500`,
    )
    .all(seller.id);
});

export const getMyPayoutsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/server/auth");
  const session = requireUser();

  const { db } = await import("@/server/db");
  if (session.role === "admin") return [];

  const seller = currentSeller(db, session.id);
  return db
    .prepare(
      "SELECT id, seller_id, amount, note, paid_at FROM seller_payouts WHERE seller_id = ? ORDER BY paid_at DESC",
    )
    .all(seller.id);
});

// ==========================================
// GESTÃO DE ADMINISTRADORES
// ==========================================

export const getAdminsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/server/auth");
  requireAdmin();

  const { db } = await import("@/server/db");
  const rows = db
    .prepare(
      `
    SELECT id, email, name, role, created_at 
    FROM users 
    WHERE role = 'admin' 
    ORDER BY created_at ASC
  `,
    )
    .all();
  return rows as { id: string; email: string; name: string; role: string; created_at: string }[];
});

export const createAdminServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120),
        email: z.string().trim().email("E-mail inválido").max(160),
        password: z.string().min(8, "Senha deve ter ao menos 8 caracteres").max(100),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    requireAdmin();

    const { db, hashPassword } = await import("@/server/db");
    const existing = db
      .prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)")
      .get(data.email);

    if (existing) {
      throw new Error("Já existe um usuário cadastrado com este e-mail.");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const hash = hashPassword(data.password);

    db.prepare(
      `
      INSERT INTO users (id, email, password_hash, name, role, created_at)
      VALUES (?, ?, ?, ?, 'admin', ?)
    `,
    ).run(id, data.email, hash, data.name, now);

    return { ok: true, id };
  });

export const deleteAdminServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/auth");
    const session = requireAdmin();

    if (session.id === data.id) {
      throw new Error("Você não pode remover a sua própria conta.");
    }

    const { db } = await import("@/server/db");

    const totalAdmins = (
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as {
        count: number;
      }
    ).count;

    if (totalAdmins <= 1) {
      throw new Error("Não é possível remover o único administrador do sistema.");
    }

    db.prepare("DELETE FROM users WHERE id = ? AND role = 'admin'").run(data.id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(data.id);

    return { ok: true };
  });
