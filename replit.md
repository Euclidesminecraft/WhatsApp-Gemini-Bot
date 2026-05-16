# T.I.Z — Talk In Zap

Bot de WhatsApp com IA Gemini + dashboard de controlo, desenvolvido para o mercado de Moçambique.

## Run & Operate

- `pnpm --filter @workspace/api-server run start-bot` — inicia o bot WhatsApp (porta 3000)
- `pnpm --filter @workspace/api-server run dev` — inicia o API Server TypeScript (porta 8080)
- `pnpm run typecheck` — verificação completa de tipos em todos os pacotes
- `pnpm run build` — typecheck + build de todos os pacotes
- `pnpm --filter @workspace/api-spec run codegen` — regera hooks e schemas Zod a partir do spec OpenAPI
- `pnpm --filter @workspace/db run push` — aplica alterações ao schema da DB (só dev)
- Env necessárias: `GEMINI_KEY` (chave API Google Gemini), `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Bot: whatsapp-web.js + LocalAuth + Puppeteer/Chromium (via Nix)
- IA: Google Gemini 2.0 Flash (`@google/generative-ai`)
- API Bot: Express (plain JS, `artifacts/api-server/index.js`, porta 3000)
- API Server: Express 5 + TypeScript (porta 8080, path `/api`)
- DB: PostgreSQL + Drizzle ORM
- Dashboard: React + Vite + TailwindCSS (porta 3001, path `/`)
- Validação: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/index.js` — Bot WhatsApp + Express API (endpoints do bot)
- `artifacts/api-server/src/` — API Server TypeScript (endpoints `/api/*`)
- `artifacts/dashboard/src/` — Dashboard React (T.I.Z Pro UI)
- `artifacts/dashboard/src/components/Layout.tsx` — Sidebar com branding T.I.Z
- `artifacts/dashboard/src/pages/Dashboard.tsx` — Página de stats e status
- `artifacts/dashboard/src/pages/PromptEditor.tsx` — Editor de prompt + teste Gemini

## Architecture decisions

- O bot (index.js) e o API Server TypeScript são dois processos separados: bot na porta 3000, API Server na 8080
- O dashboard faz proxy de `/status`, `/mensagens`, `/testar-resposta`, `/salvar-prompt`, `/pegar-prompt` para o bot na porta 3000 via Vite proxy
- Dados do bot (prompts, mensagens, status) vivem em memória — é necessário PostgreSQL para persistência em produção
- Chromium instalado via Nix (`installSystemDependencies`) para suportar Puppeteer no Replit
- Modelo Gemini actualizado para `gemini-2.0-flash` (o `gemini-1.5-flash` foi descontinuado na API v1beta)

## Product

Bot WhatsApp com IA que responde automaticamente a mensagens privadas em português. O cliente acede ao dashboard para ver estatísticas, mensagens recentes e editar o comportamento do bot via prompt. Orientado para pequenos negócios em Moçambique.

## User preferences

- Idioma: Português (PT/MZ) em todos os logs, UI e comunicação
- Branding: T.I.Z — Talk In Zap (não "BotZap Pro" nem "WhatsApp Gemini Bot")
- Mercado alvo: Moçambique — tom cordial e acessível

## Gotchas

- **Gemini 429**: A chave gratuita tem limite diário. Se `/testar-resposta` retornar erro, aguardar reset diário ou actualizar para plano pago no Google AI Studio.
- **Porta 8080 em conflito**: O API Server TypeScript (workflow `API Server`) não deve correr ao mesmo tempo que outro processo na 8080. O workflow do bot usa porta 3000.
- **Dados em memória**: Reiniciar o workflow `WhatsApp Bot` apaga todos os prompts e histórico de mensagens. Persistência requer PostgreSQL.
- **QR Code**: Após cada reinício do workflow `WhatsApp Bot`, é necessário escanear o QR no console. O LocalAuth guarda a sessão em `.wwebjs_auth/` para evitar repetição.
- **Grupos ignorados**: `message.from.endsWith('@g.us')` — mensagens de grupos são descartadas silenciosamente.

## Pointers

- Ver skill `pnpm-workspace` para estrutura do workspace, setup TypeScript e detalhes de pacotes
