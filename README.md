# Fluxo Platform

> Editor visual de fluxos conversacionais para chatbots WhatsApp (padrão Blip/Digitalbot).
> Web app Next.js 14 + Supabase + IA (Claude) com canvas drag/drop, versionamento, colaboração realtime e mais.

## 🎯 O que faz

- **Editor visual** de fluxos conversacionais com drag/drop ([React Flow 12](https://reactflow.dev/))
- **20+ tipos de bloco**: bubble bot/user, menus, botões, mídia, integração API, condicionais, atendimento humano, IAG, direcionamentos
- **Skills reutilizáveis**: sub-fluxos prontos (Falar com atendente, Validar CPF, Opt-in LGPD, etc.)
- **Voice & Tone IA**: Claude analisa consistência do tom das mensagens
- **Mock API embedded** (Postman-like) no nó de integração
- **Tabela de conteúdo** estilo planilha pra editar textos em massa
- **Outline mode** com navegação hierárquica
- **Versionamento + diff visual** entre snapshots
- **Test Playground** simulando conversa WhatsApp
- **Find & Replace** bulk com regex
- **Chat IA contextual** sobre o fluxo
- **Colaboração realtime** (presença + cursores)
- **Dark mode**, **atalhos** completos, **tour** de boas-vindas

## 🏗 Stack

| Camada | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui (Radix primitives) |
| Editor | @xyflow/react (React Flow 12) |
| Server state | TanStack Query v5 |
| Backend | Supabase (Postgres + Auth + Realtime) |
| IA | Anthropic Claude (Opus/Sonnet/Haiku) |
| Observability | Sentry (errors) + PostHog (analytics) |
| Hosting | Vercel (front) + Supabase (back) |
| Tests | Vitest (unit) + Playwright (E2E) |

## 🚀 Setup local

### Pré-requisitos
- Node.js 20+
- Conta Supabase (free tier)
- (Opcional) Anthropic API key — só pra features de IA
- (Opcional) PostHog + Sentry pra observability em prod

### Passos

**1. Clone e instale:**
```bash
git clone <repo>
cd fluxo-platform
npm install
```

**2. Configure Supabase:**
- Crie um projeto em [supabase.com](https://supabase.com) (free tier OK)
- Settings → API → copie `Project URL` e `anon public` key
- SQL Editor → rode as migrations em `supabase/migrations/` em ordem (001 → 010)
- Authentication → URL Configuration:
  - `Site URL`: `http://localhost:3000`
  - `Redirect URLs`: `http://localhost:3000/auth/callback`
- (Em dev) Authentication → Providers → Email → desligue "Confirm email"

**3. Configure env vars:**
```bash
cp .env.example .env.local
```

Edite `.env.local`:
```env
# Supabase (obrigatório)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Anthropic Claude (obrigatório pra IA — parse de docs, chat, voice & tone)
ANTHROPIC_API_KEY=sk-ant-api03-xxx

# PostHog (opcional — analytics em prod)
# Em dev, deixa vazio. O código é no-op se a key não estiver setada.
# NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
# NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Sentry (opcional — error tracking em prod)
# NEXT_PUBLIC_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
```

**4. Rodar:**
```bash
npm run dev
```
Abre `http://localhost:3000` → magic link com seu email → dashboard.

## 📜 Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (port 3000) |
| `npm run build` | Build de produção |
| `npm run start` | Roda o build de produção localmente |
| `npm run type-check` | TypeScript em watch |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários (Vitest) — 121 tests |
| `npm run test:watch` | Vitest em watch mode |
| `npm run test:cov` | Coverage |
| `npm run e2e` | Testes E2E (Playwright) |

## 📁 Estrutura do projeto

```
fluxo-platform/
├── app/                          # Next.js App Router
│   ├── auth/                     # Magic link callbacks
│   ├── dashboard/                # Dashboard logado
│   │   ├── components/           # Aba de componentes globais
│   │   └── settings/             # Configurações globais (Voice & Tone padrão)
│   ├── editor/[id]/              # Editor de fluxo de um projeto
│   ├── help/                     # 🆘 Documentação pública das features
│   ├── share/[token]/            # View pública via share token
│   └── api/                      # API routes
├── components/
│   ├── editor/                   # FlowEditor + dialogs/painéis (lazy-loaded)
│   │   ├── hooks/                # useUndoHistory, useAutoSave, useDialogStates, etc.
│   │   └── ...
│   ├── ui/                       # shadcn primitives (dialog, tabs, switch)
│   └── DialogHost.tsx            # Modal global (prompt/confirm)
├── lib/
│   ├── actions/                  # Server actions (Supabase + Claude)
│   ├── commands/                 # Registry do Cmd+K
│   ├── components/nodes/         # Custom React Flow nodes + organize layout
│   ├── content-table/            # Extração de textos pra tabela de conteúdo
│   ├── lint/                     # Validações automáticas do fluxo
│   ├── outline/                  # Build da árvore hierárquica
│   ├── playback/                 # Flow runner (Test Playground)
│   ├── skills/                   # Sub-fluxos reutilizáveis (Falar com atendente, CPF, etc.)
│   ├── versions/                 # Diff entre snapshots
│   ├── voice-tone/               # Análise de Voice & Tone com Claude
│   └── ...
└── supabase/migrations/          # SQL migrations (001 → 010)
```

## 🎓 Documentação

- **`/help`** (logado) — documentação completa das funcionalidades pros usuários
- **`CLAUDE.md`** (raiz) — instruções pro Claude (regra de manutenção da página /help)
- **`.env.example`** — todas as env vars documentadas

## 🧪 Testes

```bash
npm test          # roda 121 testes unitários (~2s)
npm run e2e       # roda Playwright (precisa de Chromium baixado)
```

Cobertura: funções puras (flow-linter, flow-runner, organize, ai-builder, diff, outline tree, content-table extractor, voice-tone schemas). UI não tem testes unitários (cobertos por E2E).

## 🎨 Componentes customizados (custom React Flow nodes)

Total: 20+ tipos. Lista completa em `lib/components/nodes/defaults.ts`. Destaques:

| Node type | O que renderiza |
|---|---|
| `frame` | Container roxo com header + bounds |
| `bubble-bot` / `bubble-user` | Balões WhatsApp (recebido / enviado) |
| `menu` | Menu modal com opções + footer |
| `btn-short` / `btn-long` | Botões em row / coluna |
| `condicional` | Decisão if/else com sourceHandles true/false |
| `direcionamento` | Pílula verde apontando pra outro frame |
| `atendimento-humano` | Caixa laranja (transbordo terminal) |
| `tracking` / `excecao` | Children visuais de bubbles |
| `integracao-api` | Integração HTTP (com **Mock API embedded**) |
| `iag-entrada` / `iag-saida` | IAG entry/exit points |
| `midia-*` | Mídia (imagem, documento, vídeo) |

## 🔐 Padrões de fluxo (memory)

Padrões reconhecidos pela IA e usados em Skills:

- **Falar com atendente** — cascata de 4 condicionais (feriado / fds / horário / disponibilidade) antes do atendimento-humano
- **Algo Mais** — 3 direcionamentos (menu / atendente / finalizar) após pergunta de continuação
- **Encerramento** — agradecimento + NPS 4 níveis + feedback livre opcional

## 📝 Contributing

Antes de abrir PR:
1. `npm run type-check` — zero erros
2. `npm run lint` — zero warnings
3. `npm test` — 121/121 passing
4. Se adicionar feature visível, **atualize `app/help/page.tsx`** (regra do CLAUDE.md)
5. Commit segue padrão: `feat(scope): titulo curto` ou `fix(scope): ...`

## 📄 License

Privado / interno.
