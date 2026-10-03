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
