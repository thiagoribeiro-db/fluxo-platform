# Instruções pro Claude — Fluxo Platform

## 🚨 REGRA IMPORTANTE: Documentação de funcionalidades

**SEMPRE que você implementar uma nova funcionalidade no editor ou dashboard, atualize também `app/help/page.tsx`** — a página de Ajuda pública mostrada aos usuários novos da plataforma.

Critério: se a feature aparece em algum botão, menu, atalho ou painel visível ao user, ela tem que estar documentada em `/help`.

Estrutura esperada da nova entrada na página de ajuda:
- Ícone/emoji + nome da feature
- Frase curta explicando "o que faz"
- 1-3 linhas de "como usar" (caminho de acesso: toolbar X → Y, ou atalho ⌘Z, etc.)
- Quando aplicável: print/exemplo visual ou link pro componente real

Categorias atuais na página de ajuda (manter ordem):
1. Começando (conceitos: frames, prefixos, IDs)
2. Atalhos do teclado
3. Toolbar do editor (com dropdowns)
4. Painéis laterais (Properties, Comments, Problems, Versions, Outline)
5. Skills (sub-fluxos reutilizáveis)
6. Voice & Tone IA
7. Tabela de conteúdo
8. Mock API
9. Versões + Diff
10. Realtime / Colaboração
11. Configurações globais
12. Tour de boas-vindas

Quando criar uma feature em alguma das 12 categorias, EDITE a seção correspondente. Quando criar feature de categoria NOVA, adicione uma seção nova mantendo a ordem semântica (conceitos → uso → recursos avançados → config).

## Regra de commits

Commit SÓ quando o user mandar a palavra "PERFEITO" (caixa alta) — confirma explicitamente que está OK pra commitar.

## Validação obrigatória antes de PERFEITO

Antes de declarar uma feature pronta, sempre rodar:
```
npm run type-check
npm run lint
npm test
```

Todos têm que passar. Se algo falhar, corrigir antes de avisar o user.

## Padrões de projeto importantes

Memórias do user em `~/.claude/projects/C--Users-SQUADRA-api/memory/`:
- `padrao_falar_com_atendente.md` — cascata de 4 condicionais antes do atendimento-humano
- `padrao_algo_mais.md` — 3 direcionamentos sem menu intermediário
- `padrao_encerramento.md` — NPS 4 níveis + feedback livre opcional
- `feedback_sequencia_logica.md` — main→main nunca direto quando há btn-short no meio

Quando implementar/editar Skills, templates ou parsers, respeitar esses padrões.

## Estrutura do projeto

- `app/` — Next.js App Router (dashboard, editor, settings, help, auth, api)
- `components/editor/` — Componentes do editor de fluxo (FlowEditor + dialogs/painéis)
- `components/ui/` — Componentes base shadcn (dialog, tabs, switch)
- `lib/` — Lógica de negócio pura, server actions, schemas, utils
  - `lib/skills/` — Sub-fluxos reutilizáveis
  - `lib/voice-tone/` — Análise de Voice & Tone
  - `lib/content-table/` — Extração de textos pra modo planilha
  - `lib/outline/` — Build da árvore hierárquica
  - `lib/versions/` — Diff entre snapshots
  - `lib/playback/` — Flow runner do Test Playground
  - `lib/lint/` — Validações automáticas
  - `lib/commands/` — Registry do Cmd+K
- `supabase/migrations/` — SQL migrations
