const { exec, spawn } = require("child_process");

const INTERVALO = 5000;
const RAIZ_PROJETO = __dirname;

let serverProcess = null;
let verificandoGit = false;
let reiniciando = false;

function executar(comando) {
    return new Promise((resolve, reject) => {
        exec(
            comando,
            {
                cwd: RAIZ_PROJETO,
                windowsHide: true,
                maxBuffer: 10 * 1024 * 1024,
            },
            (error, stdout, stderr) => {
                if (error) {
                    reject({ error, stdout, stderr });
                    return;
                }

                resolve({ stdout, stderr });
            }
        );
    });
}

function iniciarServidor() {
    if (serverProcess) return;

    console.log("🚀 Iniciando servidor da aplicação...");

    serverProcess = spawn("cmd.exe", ["/c", "npm", "run", "dev"], {
        cwd: RAIZ_PROJETO,
        stdio: "inherit",
        windowsHide: false,
    });

    serverProcess.on("close", (code) => {
        console.log(`⚠️ Servidor parou com código ${code}`);
        serverProcess = null;

        if (!reiniciando) {
            console.log("🔄 Servidor caiu. Reiniciando em 2 segundos...");
            setTimeout(iniciarServidor, 2000);
        }
    });

    serverProcess.on("error", (error) => {
        console.error("❌ Erro ao iniciar servidor:", error);
        serverProcess = null;
    });
}

function reiniciarServidor() {
    if (reiniciando) return;

    reiniciando = true;
    console.log("🔄 Reiniciando o servidor para aplicar as novidades...");

    if (!serverProcess) {
        reiniciando = false;
        iniciarServidor();
        return;
    }

    const pid = serverProcess.pid;

    exec(`taskkill /pid ${pid} /f /t`, { windowsHide: true }, () => {
        serverProcess = null;

        setTimeout(() => {
            reiniciando = false;
            iniciarServidor();
        }, 1500);
    });
}

async function verificarGitHub() {
    if (verificandoGit) return;

    verificandoGit = true;

    try {
        await executar("git fetch origin main");

        const resultado = await executar(
            "git rev-list --count HEAD..origin/main"
        );

        const commitsNovos = Number(resultado.stdout.trim());

        if (commitsNovos > 0) {
            console.log(
                `\n📥 ${commitsNovos} nova(s) alteração(ões) detectada(s) no GitHub!`
            );

            const pull = await executar("git pull --ff-only origin main");

            console.log("✅ Pull realizado com sucesso!");
            console.log(pull.stdout);

            // Se uma atualização alterou dependências, sincroniza o node_modules
            // antes de reiniciar o Vite. Assim o Auto Pull também funciona
            // quando uma feature nova adiciona um pacote npm.
            try {
                const arquivosAlterados = await executar("git diff --name-only ORIG_HEAD HEAD");
                const precisaInstalarDependencias =
                    /(^|\n)(package\.json|package-lock\.json)(\n|$)/.test(
                        arquivosAlterados.stdout
                    );

                if (precisaInstalarDependencias) {
                    console.log("📦 Dependências alteradas. Executando npm install...");
                    const install = await executar("npm install --no-audit --no-fund");
                    console.log(install.stdout);
                }
            } catch (erroDependencias) {
                console.error("❌ Falha ao instalar dependências:");
                console.error(erroDependencias.stderr || erroDependencias.error?.message || erroDependencias);
                return;
            }

            reiniciarServidor();
        }
    } catch (erro) {
        console.error("❌ Erro ao verificar GitHub:");

        if (erro.stderr) {
            console.error(erro.stderr);
        } else if (erro.error) {
            console.error(erro.error.message);
        }
    } finally {
        verificandoGit = false;
    }
}

console.log("========================================");
console.log("   MATRIX ONLINE - AUTO PULL");
console.log("========================================");
console.log(`📁 Projeto: ${RAIZ_PROJETO}`);
console.log(`⏱️ Intervalo: ${INTERVALO / 1000}s`);
console.log("========================================\n");

iniciarServidor();
setInterval(verificarGitHub, INTERVALO);
