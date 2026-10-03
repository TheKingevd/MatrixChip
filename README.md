# Matrix Online — Venda Oficial de Chips Físicos

Sistema de e-commerce e gestão de venda de **chips físicos reais** nacionais (com todos os DDDs do Brasil) e internacionais (+190 países), com envio expresso via Correios e banco de dados autônomo em **SQLite 3**.

---

## ⚡ Principais Recursos

- **Catálogo de Chips Físicos**:
  - Chips Nacionais com seleção dinâmica de qualquer DDD brasileiro (11 a 99).
  - Chips Internacionais para viagens e negócios (+190 países).
  - Consulta de estoque e preços em tempo real.
- **Checkout Completo de Chip Físico**:
  - Dados do destinatário com validação de CPF.
  - Endereço de entrega com busca e preenchimento automático pelo CEP (ViaCEP).
  - Pagamento instantâneo via PIX (QR Code e Copia e Cola).
  - Aplicação de cupons de desconto (`MATRIX10`, `BEMVINDO`).
  - Tela pública de acompanhamento do pedido com status em tempo real.
- **Painel Administrativo (`/admin`)**:
  - Gestão de pedidos e envios com visualização do endereço completo.
  - Registro de **Código de Rastreamento dos Correios** para o cliente.
  - Alteração de status (`Pendente`, `Pago`, `Em Preparação`, `Enviado`, `Entregue`).
  - Controle de pagamentos PIX e comprovantes.
  - Gestão de preços, estoques, cupons de desconto, vendedores e comissões.
- **Banco de Dados SQLite 3 Local**:
  - 100% autônomo, sem dependência de nuvem ou serviço externo.
  - Arquivo do banco localizado em `data/matrix.db` (não versionado).

---

## 🔐 Acesso Administrativo

- **URL do Painel**: `/auth` (administradores) ou `/vendedor` (vendedores)
- **Primeiro acesso**: definido por você no `.env` (`ADMIN_EMAIL` e `ADMIN_PASSWORD`), usado apenas quando o banco ainda não tem nenhum usuário.
- **Senha provisória**: troque em **Administradores → Minha senha** (`/admin/admins`) no primeiro login.
- **Novos Admins**: cadastre na aba **Administradores** (`/admin/admins`).
- **Vendedores**: crie o login de cada um na aba **Vendedores** (`/admin/vendedores`).

Nenhuma senha fica no código: o repositório não guarda credenciais.

---

## 🚀 Como Executar

```bash
cp .env.example .env   # preencha ADMIN_EMAIL e ADMIN_PASSWORD
npm install

# Desenvolvimento (porta 4904)
npm run dev
```

### Produção

O banco é SQLite local (`data/matrix.db`), então o alvo é um **processo Node com disco
persistente** — não use funções serverless nem plataformas que não persistam arquivos.

```bash
npm run build
npm start            # node .output/server/index.mjs
```

Variáveis de ambiente: veja `.env.example`. Se estiver atrás de um proxy reverso
(nginx/Caddy/Cloudflare), defina `TRUST_PROXY=1` para que o limite de tentativas de
login use o IP real do cliente.


## PIX real — Asaas ou Mercado Pago

O checkout usa o gateway definido no servidor e gera um QR Code PIX dinâmico por pedido.

No `.env`:

```env
PAYMENT_PROVIDER=asaas

# Sandbox Asaas
ASAAS_API_URL=https://api-sandbox.asaas.com
ASAAS_ACCESS_TOKEN=

# Ou Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=
```

Para produção Asaas, troque `ASAAS_API_URL` para `https://api.asaas.com` e use a chave de produção correspondente. A chave nunca deve ir para o frontend ou para o GitHub. O Asaas usa `access_token` no backend; o Mercado Pago usa Access Token e `X-Idempotency-Key` para criação segura do pagamento. 

O cliente informa os dados, cria/acessa a conta, o pedido é registrado e o gateway retorna o QR Code e o PIX Copia e Cola. A área `/conta` mostra os pedidos do cliente, pagamento, status do chip e código de rastreio.


## PWA, sessão persistente e notificações

O Matrix Online agora funciona como PWA:

- Manifesto com modo `standalone`, ícones 192/512 e instalação na tela inicial.
- No Android/Chrome, quando o navegador disponibilizar o instalador, o sistema mostra o botão **Instalar**.
- No iPhone/iPad, use **Compartilhar → Adicionar à Tela de Início**. Depois de instalado, o app abre sem a barra normal do navegador.
- A sessão administrativa usa cookie `httpOnly` persistente por 30 dias e é renovada enquanto o usuário continua usando o sistema.
- O painel administrativo possui **Ativar notificações**. Depois de conceder a permissão, o navegador registra o dispositivo no servidor.
- As notificações usam Web Push + Service Worker e podem chegar mesmo com o navegador/app fechado, nos navegadores e plataformas que suportam Web Push.
- O servidor gera as chaves VAPID automaticamente na primeira ativação e as mantém no SQLite. `VAPID_SUBJECT` pode ser configurado no `.env` para identificar o servidor.

Eventos que geram push para administradores:

1. Novo pedido de chip.
2. Pagamento confirmado pelo gateway.
3. Novo cupom criado.
4. Cupom resgatado em uma compra.

> Para produção, o domínio precisa estar em HTTPS para instalação e notificações. No iPhone, o Web Push depende do PWA estar instalado na Tela de Início.
