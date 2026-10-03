import fs from "node:fs";
import path from "node:path";

let loaded = false;

/**
 * Carrega o arquivo .env para process.env, uma única vez.
 *
 * Sem isso, variáveis como ADMIN_EMAIL e TRUST_PROXY só existiriam se fossem
 * exportadas pelo processo (systemd/Docker) — e o bootstrap do primeiro admin
 * dependeria de configuração manual do ambiente.
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  const file = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;

  try {
    // Node 20.12+ / 21.7+
    process.loadEnvFile(file);
  } catch {
    // Versão de Node sem loadEnvFile: siga com o ambiente do processo.
  }
}
