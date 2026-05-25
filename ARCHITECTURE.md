# Arquitetura — Fluxo Platform

Visão geral pra quem precisa entender o projeto. Mantenha-se curto e
atualizado quando o desenho mudar.

## Stack

- **Next.js 14** (App Router, Server Components, Server Actions)
- **React Flow 12** (`@xyflow/react`) — canvas do editor
- **Supabase** — Postgres + Auth + RLS + Realtime
- **Anthropic Claude** — IA generativa (parse de escopo, voice/tone, chat)
- **TanStack Query** — fetch + cache reativo
- **Radix UI** + **shadcn/ui** — primitivos
- **cmdk** — command palette
- **Sentry** + **PostHog** — erros + analytics

## Camadas

```
┌─────────────────────────────────────────────────────────────┐
│  app/                  ← rotas (App Router)                  │
│    dashboard/          ← gerenciar projetos                  │
│    editor/[id]/        ← FlowEditor (canvas)                 │
│    share/[token]/      ← link público                        │
│    help/               ← documentação user-facing            │
├─────────────────────────────────────────────────────────────┤
│  components/                                                 │
│    editor/             ← FlowEditor + painéis + hooks        │
│    ui/                 ← Badge, Dialog, etc. (shadcn-style)  │
│    ErrorBoundary.tsx   ← isolamento de crash                 │
├─────────────────────────────────────────────────────────────┤
│  lib/                                                        │
│    actions/            ← server actions (mutações + queries) │
│    parser/             ← escopo → ProjectState               │
│    skills/             ← sub-fluxos reusáveis                │
│    templates/          ← templates de projeto                │
│    components/nodes/   ← React Flow node components + helpers│
│    lint/               ← flow-linter (regras qualidade)      │
│    playback/           ← interpretador pra Test Playground   │
│    voice-tone/         ← análise IA do tom                   │
│    schemas/            ← Zod schemas (input + IA output)     │
│    utils/              ← Result, rate-limit, storage, etc.   │
│    constants/          ← magic numbers (layout, timing)      │
├─────────────────────────────────────────────────────────────┤
│  supabase/                                                   │
│    migrations/         ← schema + RPCs SQL                   │
└─────────────────────────────────────────────────────────────┘
```

## Fluxos principais

### Salvar projeto

```
FlowEditor (client) ─ debounce ─►  useAutoSave  ─►  saveProjectState (action)
                                                          │
                                                          ▼
                                            Supabase: project_pages.state
```

State vive em `project_pages.state` (uma JSON por página). `projects.state`
existe como backup legado pra compat.

### Compartilhamento

```
1. Owner cria share → POST shares (RLS: member da org)
                  → audit_events.log
2. Cliente abre /share/[token] → RPC get_shared_project (SECURITY DEFINER)
                  → retorna state da page ativa
3. Cliente comenta (modo 'comment') → RPC create_share_comment
                  → comment com author_id = NULL, external_author_name = digitado
```

### Carregar template

```
TemplateDialog → applyTemplate(projectId, name) [action]
                   ├─ valida Zod (ApplyTemplateInput)
                   ├─ snapshot prévio (page_versions)
                   ├─ rebuild ProjectState pelo template
                   ├─ saveStateOnActivePageOrLegacy
                   └─ logAuditEvent('template.applied')
```

### Importar escopo (PDF/MD/TXT)

```
Cliente seleciona modo:
  - Regex: parseEscopoText (lib/parser/regex/) — sem IA, instantâneo
  - IA:    parseEscopoWithAI → Claude Opus
                ├─ rate limit (5/min/user)
                ├─ tool_use validado por Zod
                ├─ logIaUsage (tokens + custo)
                └─ buildStateFromAIResult
```

## Padrões críticos

### React Flow + state

- `nodes` e `edges` são o **fonte da verdade** do canvas
- React Flow trata `position` como **relativa ao parent** quando há
  `parentId`. Trackings/exceções usam parentId; mains não
- `data` em cada node é `Record<string, unknown>` — type narrowing via
  `n.type` é o que estreita

### IDs e codes

- Cada node tem `id` (uuid-ish) e `code` (S001, OF002, etc.) que é
  user-facing
- Code é gerado por prefix do frame que o contém (`resolveFramePrefix`)
- Code é INDEXADO pelo Find & Replace (busca por "S001" funciona) mas
  NÃO é editável via replace (REPLACE_BLOCKED em find-replace.ts)

### Migrations

- Numeradas: `001_initial_schema.sql` → `022_ia_usage.sql`
- Idempotentes (re-rodar não quebra)
- Comentário no topo explica o POR QUÊ
- DEV antes de PRD; **019-022 são da última onda**, sempre rodar em ordem

### Realtime

- Cursores compartilhados via `supabase.channel('presence')`
- Throttled em `CURSOR_THROTTLE` (50ms = 20Hz)
- Cleanup automático no `useEffect` de unmount

### Hooks customizados (`components/editor/hooks/`)

Extrair do FlowEditor quando há responsabilidade isolável:
- `use-dialog-states.ts` — abrir/fechar dialogs
- `use-undo-history.ts` — pilha undo/redo
- `use-auto-save.ts` — debounce + persistência
- `use-pages.ts` — switch entre páginas
- `use-flow-operations.ts` — duplicate/group/align/delete

## Convenções

- **Comments em PT-BR** explicando POR QUÊ (decisão tomada), não O QUÊ (código já mostra)
- **Server actions** sempre `'use server'` no topo, exportam só async functions
- **Imports absolutos** via `@/...` (configurado em `tsconfig.json`)
- **Tailwind** direto no JSX OK, mas patterns repetidos → `components/ui/`

## Onde NÃO mexer sem cuidado

- `lib/components/nodes/helpers.ts` (1.6k LOC) — auto-layout, organize,
  posicionamento. Toca aqui = afetar todos os fluxos visualmente
- `lib/parser/ai-system-prompt.ts` — system prompt da IA. Mudança pode
  estourar custo ou quebrar parsing
- Migrations já aplicadas em prod — sempre criar nova migration pra
  alteração, **nunca editar** existentes

## Limites conhecidos

- FlowEditor.tsx ~2300 LOC, em refator gradual (`useFlowOperations`,
  próximo: `useSkillOperations`, `useLayoutEngine`)
- PropertiesPanel.tsx ~1500 LOC, candidato a split por tipo de node
- Rate limit em memória — não compartilha entre instâncias Vercel
  (aceitável por enquanto)
- Templates "Educação" e "Financeiro" listados em /help mas ainda não
  implementados (placeholder)
