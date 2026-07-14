# Red Burguer

Site de hamburgueria com cardápio, carrinho e checkout via PIX (Mercado Pago) — estilo iFood/Burger King, dark + vermelho/amarelo.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — roda a API (porta 8080, exposta em `/api`)
- `pnpm --filter @workspace/red-burguer run dev` — roda o frontend (artifact "Red Burguer", `previewPath: "/"`)
- `pnpm run typecheck` — typecheck completo de todos os pacotes
- `pnpm run build` — typecheck + build de todos os pacotes
- `pnpm --filter @workspace/api-spec run codegen` — regenera hooks de API e schemas Zod a partir do OpenAPI spec (`lib/api-spec/openapi.yaml`)
- `pnpm --filter @workspace/db run push` — aplica alterações de schema no banco (dev)
- `pnpm --filter @workspace/scripts run seed:menu` — popula a tabela `menu_items` (só insere se estiver vazia)
- Env necessária: `DATABASE_URL` (Postgres), `MERCADOPAGO_ACCESS_TOKEN` (token de produção do Mercado Pago, já configurado como secret)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (`artifacts/api-server`)
- Frontend: React + Vite + Tailwind + shadcn/ui (`artifacts/red-burguer`)
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Validação: Zod (`zod/v4`), `drizzle-zod`
- Codegen de API: Orval (a partir do OpenAPI spec) → hooks React Query em `lib/api-client-react`, schemas Zod em `lib/api-zod`
- Pagamento: integração direta com a API REST oficial do Mercado Pago (sem SDK), usando `fetch` nativo

## Onde as coisas estão

- Contrato da API: `lib/api-spec/openapi.yaml` (fonte da verdade; roda `codegen` após editar)
- Schema do banco: `lib/db/src/schema/menu-items.ts` e `orders.ts`
- Rotas da API: `artifacts/api-server/src/routes/{menu,orders,webhooks}.ts`
- Integração Mercado Pago: `artifacts/api-server/src/lib/mercadopago.ts`
- Frontend: `artifacts/red-burguer/src/pages/{Home,Checkout,Payment}.tsx`, carrinho em `src/context/CartContext.tsx`
- Imagens do cardápio: `artifacts/red-burguer/public/menu/*.jpg` (servidas como estático, referenciadas pelo campo `imageUrl` no banco)

## Architecture decisions

- Preços são resolvidos sempre no servidor a partir do `menu_items` ao criar um pedido — nunca se confia no preço enviado pelo cliente.
- Atualização de status do pagamento no frontend é via polling (`useGetOrder` com `refetchInterval` de 3s), parando automaticamente em status terminais (`approved`/`rejected`/`cancelled`/`expired`).
- Confirmação segura de pagamento é via webhook do Mercado Pago (`POST /api/webhooks/mercadopago`, fora do contrato OpenAPI): o corpo do webhook nunca é confiado diretamente — ele só indica qual `payment_id` mudou, e o servidor sempre busca o status real na API do Mercado Pago antes de atualizar o pedido.
- Pedidos em `awaiting_payment` com `pixExpiresAt` no passado são marcados como `expired` de forma lazy no `GET /orders/:id`, sem necessidade de job em background.
- `POST /orders/:id/pix` é idempotente: se já existe um PIX válido (não expirado) ou o pedido já está aprovado, retorna o pedido existente em vez de gerar uma nova cobrança.

## Product

- `/` — cardápio agrupado por categoria com carrinho persistente (localStorage)
- `/checkout` — dados do cliente (nome, telefone, e-mail, CPF opcional) + observações
- `/pagamento/:orderId` — geração automática do PIX, QR code, código "copia e cola", contador de expiração, polling de status, tela de sucesso animada e tratamento de erros/status recusado/expirado

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- O token do Mercado Pago em uso é de **produção** (`live_mode`, conta real verificada) — pagamentos PIX gerados são reais. Use valores baixos ao testar manualmente.
- A API do Mercado Pago rejeita e-mails de pagador com domínio inexistente (sem MX válido) com o erro genérico "Invalid users involved" (code 2034) — sempre valide/use e-mails de domínio real ao testar.
- O CSS do frontend usa fontes do Google Fonts via `@import url(...)`; com Tailwind v4, esse `@import` precisa vir **antes** de `@import 'tailwindcss'`, senão o build falha com "@import must precede all other statements".

## Pointers

- Veja a skill `pnpm-workspace` para estrutura do workspace, setup de TypeScript e detalhes dos pacotes.
