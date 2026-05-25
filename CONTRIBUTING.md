# Contribuindo — Fluxo Platform

Guia rápido pra quem vai mexer no código. Mantenha simples.

## Setup local

```bash
git clone https://github.com/thiagoribeiro-db/fluxo-platform.git
cd fluxo-platform
npm install
cp .env.example .env.local   # preencha as chaves Supabase + Anthropic
npm run dev                  # http://localhost:3000
```

## Comandos diários

```bash
npm run dev          # servidor de desenvolvimento
npm run type-check   # tsc --noEmit
npm run lint         # next lint
npm test             # vitest (unitários)
npm run test:e2e     # playwright (se Supabase rodando)
npm run build        # next build (sanity check antes de PR)
```

## Branch + commit

- **`main`** é a branch de produção. Vercel deploya automaticamente nela.
- Trabalhe em **branches feature** (`feature/<slug>`, `fix/<slug>`). Abra PR pra `main`.
- O CI roda type-check + lint + test + build em todo PR — **não mergeie com falha**.
- Commits no padrão **conventional**:
  - `feat(escopo): mensagem curta` — feature nova
  - `fix(escopo): mensagem` — bug fix
  - `refactor(escopo): mensagem` — sem mudar comportamento
  - `chore(escopo): mensagem` — build/deps/lint
  - `docs(escopo): mensagem` — documentação
- Use HEREDOC pra commit messages multi-linha (preserva formatação).

## Validação obrigatória antes de PR

Sempre rodar antes de commitar:

```bash
npm run type-check && npm run lint && npm test
```

Se algo falhar, corrija antes do commit. Não passe pelo CI quebrado.

## Padrões de código

### Server actions (`lib/actions/*.ts`)
- Validar input com Zod (`lib/schemas/actions.ts`)
- Retornar `Result<T, E>` pra novas actions (`lib/utils/result.ts`); manter `throw` em actions legadas pra compat
- Rate limit em chamadas Anthropic (`checkIaRateLimit` em `lib/utils/rate-limit.ts`)
- Audit log em ações sensíveis (`logAuditEvent` em `lib/actions/audit.ts`)

### Componentes React
- `'use client'` só onde necessário (interatividade). Server Components por padrão.
- Dialogs/painéis pesados via `dynamic(import, { ssr: false, loading: () => null })` em FlowEditor
- Tailwind direto no JSX é OK, mas pra patterns repetidos use `components/ui/badge.tsx`, etc.
- ErrorBoundary em features grandes (editor, dashboards pesados)

### Migrations Supabase
- Numerar sequencialmente em `supabase/migrations/`: `019_*`, `020_*`, ...
- Comentário no topo explicando POR QUÊ (não só o quê)
- `IDEMPOTENTE` no header — `create or replace`, `if not exists`, `drop if exists` etc.
- Aplicar em DEV primeiro, testar, depois PRD
- Sem migrations down — fazemos rollback via nova migration (mais auditável)

### localStorage
- Chave padrão: `fluxo:<feature>:v<N>` (versionada)
- Usar `loadVersioned()/saveVersioned()` de `lib/utils/storage.ts`
- Adicionar `migrations` array quando bumpar versão

## Documentação

- Ao adicionar feature visível ao user, **atualize `app/help/page.tsx`** (regra em CLAUDE.md)
- Comentários `// SOLID-style` no código (POR QUÊ, não O QUÊ) ajudam o próximo dev
- Arquitetura geral → `ARCHITECTURE.md`

## Testes

- Vitest pra unidade: `lib/**/*.test.ts` (puros, sem React)
- Testes que tocam `localStorage` precisam stub global (ver `lib/snippets/manager.test.ts`)
- Playwright pra E2E: `e2e/**/*.spec.ts` (precisa Supabase local)

## Onde pedir ajuda

- Padrões de cliente/Blip: `lib/parser/ai-system-prompt.ts` + `~/.claude/projects/.../memory/`
- Schema do banco: `supabase/migrations/` (lendo em ordem)
- O que mexe onde: `ARCHITECTURE.md`
