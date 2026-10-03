# Roadmap

## Concluído
- [x] Blocos pulsando em outra cor ao passar o mouse (hover em heartbeat-glow: magenta/ciano, pulso mais rápido)
- [x] Tela de envios PIX (/admin/pix): comprovante anexado, confirmação com data/hora
- [x] Cupons: tabela, tela admin (/admin/cupons), desconto no PDV e vitrine de cupons ativos no site
- [x] Sessão em cookie httpOnly + autorização por papel em todas as server functions
- [x] Preço, desconto e cupom calculados no servidor (checkout não confia no navegador)
- [x] ID de pedido aleatório (MTX- + 12 hex) e consulta pública sem CPF/e-mail
- [x] Portal do vendedor vendo apenas as próprias vendas; troca de senha pelo painel
- [x] Build de produção em Node (o SQLite não roda em Cloudflare Workers)

## Em andamento
- [ ] Área do cliente: cadastro no checkout, login e painel com status do pedido + botão de suporte no WhatsApp

## Ideias / depois
- [ ] Rate limit de login distribuído (hoje é em memória, por processo)
- [ ] Comprovantes em object storage em vez de base64 no SQLite
- [ ] Página de rastreio com rate limit por IP
- [ ] Página de erro do SSR traduzida para pt-BR
