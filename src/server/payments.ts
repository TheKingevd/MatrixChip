import crypto from "node:crypto";
import { db } from "./db";

export type PaymentProvider = "asaas" | "mercadopago";

export type PixCharge = {
  provider: PaymentProvider;
  externalId: string;
  qrCode: string;
  qrCodeBase64: string;
  qrCodeDataUrl: string;
  ticketUrl?: string | null;
  expiresAt?: string | null;
};

function getPaymentSettings() {
  try {
    const rows = db.prepare(
      "SELECT key, value FROM app_settings WHERE key IN ('payment_provider','asaas_access_token','asaas_api_url','mercadopago_access_token','public_app_url')",
    ).all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((row) => [row.key, row.value])) as Record<string, string>;
  } catch {
    return {};
  }
}

function provider(): PaymentProvider {
  const settings = getPaymentSettings();
  const value = (settings["payment_provider"] || process.env["PAYMENT_PROVIDER"] || "asaas").trim().toLowerCase();
  if (value !== "asaas" && value !== "mercadopago") {
    throw new Error('PAYMENT_PROVIDER deve ser "asaas" ou "mercadopago".');
  }
  return value;
}

function settingOrEnv(settingsKey: string, envKey: string) {
  const settings = getPaymentSettings();
  return settings[settingsKey]?.trim() || process.env[envKey]?.trim() || "";
}

async function apiJson(url: string, init: RequestInit, providerName: string) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  if (!response.ok) {
    const detail =
      body?.errors?.map?.((e: any) => e.description || e.code).filter(Boolean).join(" | ") ||
      body?.message ||
      \`HTTP \${response.status}\`;
    throw new Error(\`\${providerName}: \${detail}\`);
  }
  return body;
}

function qrDataUrl(base64: string): string {
  if (base64.startsWith("data:")) return base64;
  return \`data:image/png;base64,\${base64}\`;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] || "Cliente",
    lastName: parts.slice(1).join(" ") || "Matrix Online",
  };
}

async function createAsaasCharge(input: {
  orderId: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  total: number;
}): Promise<PixCharge> {
  const token = settingOrEnv("asaas_access_token", "ASAAS_ACCESS_TOKEN");
  if (!token) throw new Error("ASAAS_ACCESS_TOKEN não configurado no .env.");

  const base = (settingOrEnv("asaas_api_url", "ASAAS_API_URL") || "https://api.asaas.com").replace(/\/$/, "");
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
    access_token: token,
    "User-Agent": "MatrixOnline/1.0",
  };

  const customer = await apiJson(
    \`\${base}/v3/customers\`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        cpfCnpj: input.cpf.replace(/\D/g, ""),
        phone: input.phone.replace(/\D/g, ""),
        externalReference: input.orderId,
      }),
    },
    "Asaas",
  );

  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const payment = await apiJson(
    \`\${base}/v3/payments\`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: customer.id,
        billingType: "PIX",
        value: Number(input.total.toFixed(2)),
        dueDate,
        description: \`Matrix Online - Pedido \${input.orderId}\`,
        externalReference: input.orderId,
      }),
    },
    "Asaas",
  );

  const qr = await apiJson(
    \`\${base}/v3/payments/\${encodeURIComponent(payment.id)}/pixQrCode\`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        "User-Agent": "MatrixOnline/1.0",
        access_token: token,
      },
    },
    "Asaas",
  );

  return {
    provider: "asaas",
    externalId: String(payment.id),
    qrCode: String(qr.payload || ""),
    qrCodeBase64: String(qr.encodedImage || ""),
    qrCodeDataUrl: qrDataUrl(String(qr.encodedImage || "")),
    ticketUrl: payment.invoiceUrl || null,
    expiresAt: qr.expirationDate || null,
  };
}

async function createMercadoPagoCharge(input: {
  orderId: string;
  name: string;
  email: string;
  cpf: string;
  total: number;
}): Promise<PixCharge> {
  const token = settingOrEnv("mercadopago_access_token", "MERCADOPAGO_ACCESS_TOKEN");
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado no .env.");

  const { firstName, lastName } = splitName(input.name);
  const idempotencyKey = crypto.randomUUID();

  const payment = await apiJson(
    "https://api.mercadopago.com/v1/payments",
    {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${token}\`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: Number(input.total.toFixed(2)),
        description: \`Matrix Online - Pedido \${input.orderId}\`,
        payment_method_id: "pix",
        external_reference: input.orderId,
        ...((settingOrEnv("public_app_url", "PUBLIC_APP_URL")) ? {
          notification_url: `${settingOrEnv("public_app_url", "PUBLIC_APP_URL").replace(/\/$/, "")}/api/webhooks/mercadopago`,
        } : {}),
        payer: {
          email: input.email,
          first_name: firstName,
          last_name: lastName,
          identification: {
            type: "CPF",
            number: input.cpf.replace(/\D/g, ""),
          },
        },
      }),
    },
    "Mercado Pago",
  );

  const data = payment?.point_of_interaction?.transaction_data;
  const qr = String(data?.qr_code || "");
  const base64 = String(data?.qr_code_base64 || "");

  if (!qr || !base64) {
    throw new Error("Mercado Pago não retornou o QR Code PIX.");
  }

  return {
    provider: "mercadopago",
    externalId: String(payment.id),
    qrCode: qr,
    qrCodeBase64: base64,
    qrCodeDataUrl: qrDataUrl(base64),
    ticketUrl: data?.ticket_url || null,
  };
}

export async function createPixCharge(input: {
  orderId: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  total: number;
}): Promise<PixCharge> {
  const selected = provider();
  return selected === "asaas"
    ? createAsaasCharge(input)
    : createMercadoPagoCharge(input);
}

export async function getPixStatus(
  selectedProvider: PaymentProvider,
  externalId: string,
): Promise<{ status: string; paid: boolean }> {
  if (selectedProvider === "asaas") {
    const token = process.env["ASAAS_ACCESS_TOKEN"]?.trim();
    if (!token) throw new Error("ASAAS_ACCESS_TOKEN não configurado no .env.");
    const base = (process.env["ASAAS_API_URL"] || "https://api.asaas.com").replace(/\/$/, "");
    const payment = await apiJson(
      \`\${base}/v3/payments/\${encodeURIComponent(externalId)}\`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          access_token: token,
          "User-Agent": "MatrixOnline/1.0",
        },
      },
      "Asaas",
    );
    const status = String(payment.status || "PENDING");
    return { status, paid: status === "RECEIVED" || status === "CONFIRMED" };
  }

  const token = process.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim();
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado no .env.");
  const payment = await apiJson(
    \`https://api.mercadopago.com/v1/payments/\${encodeURIComponent(externalId)}\`,
    {
      method: "GET",
      headers: { Authorization: \`Bearer \${token}\`, Accept: "application/json" },
    },
    "Mercado Pago",
  );
  const status = String(payment.status || "pending");
  return { status, paid: status === "approved" };
}
