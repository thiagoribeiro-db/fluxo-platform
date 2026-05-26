/**
 * Validador de Flow — checa coerência das screens antes de exportar.
 *
 * Regras (alinhadas com Meta Flow JSON v7.1):
 *  - Exatamente 1 entry screen
 *  - Pelo menos 1 terminal (action: complete) alcançável
 *  - Todas navigate.next apontam pra screen existente
 *  - Não há screens órfãs (não alcançáveis a partir da entry)
 *  - Cada Footer com `name` único dentro de uma screen
 *  - Inputs com `name` único dentro de uma screen
 *
 * Output: array de Problem (estrutura igual ao flow-linter principal).
 */

import type {
  WhatsAppFlowComponent,
  WhatsAppFlowScreen,
} from '@/lib/types';

export interface FlowValidationProblem {
  code:
    | 'no-entry-screen'
    | 'multiple-entry-screens'
    | 'no-terminal-reachable'
    | 'navigate-target-missing'
    | 'orphan-screen'
    | 'duplicate-input-name'
    | 'screen-no-footer'
    | 'image-no-src'
    | 'data-exchange-no-endpoint';
  severity: 'error' | 'warning' | 'info';
  message: string;
  /** ID da screen onde ocorreu (se aplicável). */
  screenId?: string;
  /** ID do component (se aplicável). */
  componentId?: string;
}

export interface ValidateFlowInput {
  screens: WhatsAppFlowScreen[];
  /** URL configurada do endpoint pra `data_exchange`. Vazio = client-only. */
  dataChannelUri?: string;
}

export function validateFlow(input: ValidateFlowInput): FlowValidationProblem[] {
  const { screens, dataChannelUri } = input;
  const problems: FlowValidationProblem[] = [];

  // ----- 1. Entry screen (exatamente 1) ----------------------------------
  const entries = screens.filter((s) => s.isEntry);
  if (entries.length === 0) {
    problems.push({
      code: 'no-entry-screen',
      severity: 'error',
      message: 'Nenhuma tela marcada como inicial. Marque exatamente 1 como "entry".',
    });
  } else if (entries.length > 1) {
    problems.push({
      code: 'multiple-entry-screens',
      severity: 'error',
      message: `${entries.length} telas marcadas como inicial. Deve ser exatamente 1.`,
    });
  }

  // ----- 2. Navigate targets existem -------------------------------------
  const screenIds = new Set(screens.map((s) => s.id));
  for (const s of screens) {
    for (const c of s.components) {
      const action = getAction(c);
      if (action?.name === 'navigate') {
        const target = action.next.name;
        if (!screenIds.has(target)) {
          problems.push({
            code: 'navigate-target-missing',
            severity: 'error',
            message: `Component "${getComponentLabel(c)}" navega pra tela "${target}" que não existe`,
            screenId: s.id,
            componentId: c.id,
          });
        }
      }
    }
  }

  // ----- 3. Cada screen tem ao menos 1 Footer ----------------------------
  // (Sem Footer, o user fica preso). Permite exceção quando há EmbeddedLink
  // ou OptIn com action.
  for (const s of screens) {
    const hasFooter = s.components.some((c) => c.type === 'Footer');
    const hasInteractiveExit = s.components.some(
      (c) =>
        (c.type === 'EmbeddedLink' || c.type === 'OptIn') &&
        getAction(c) !== undefined
    );
    if (!hasFooter && !hasInteractiveExit) {
      problems.push({
        code: 'screen-no-footer',
        severity: 'warning',
        message: `Tela "${s.title || s.id}" sem Footer — usuário fica preso`,
        screenId: s.id,
      });
    }
  }

  // ----- 4. Screens órfãs (não alcançáveis a partir da entry) ------------
  if (entries.length === 1) {
    const reachable = reachableFrom(entries[0].id, screens);
    for (const s of screens) {
      if (!reachable.has(s.id)) {
        problems.push({
          code: 'orphan-screen',
          severity: 'warning',
          message: `Tela "${s.title || s.id}" não é alcançável a partir da inicial`,
          screenId: s.id,
        });
      }
    }
  }

  // ----- 5. Terminal alcançável ------------------------------------------
  if (entries.length === 1) {
    const reachable = reachableFrom(entries[0].id, screens);
    const hasTerminalReachable = screens.some((s) => {
      if (!reachable.has(s.id)) return false;
      if (s.isTerminal) return true;
      // Ou: tem algum component cuja action é "complete"
      return s.components.some((c) => getAction(c)?.name === 'complete');
    });
    if (!hasTerminalReachable) {
      problems.push({
        code: 'no-terminal-reachable',
        severity: 'error',
        message: 'Nenhum caminho leva a "complete" (encerrar Flow) — usuário não consegue finalizar',
      });
    }
  }

  // ----- 6. Inputs com `name` único na mesma screen ----------------------
  for (const s of screens) {
    const seen = new Map<string, string[]>();
    for (const c of s.components) {
      const name = (c as { name?: string }).name;
      if (!name) continue;
      if (!seen.has(name)) seen.set(name, []);
      seen.get(name)!.push(c.id);
    }
    for (const [name, ids] of seen.entries()) {
      if (ids.length > 1) {
        problems.push({
          code: 'duplicate-input-name',
          severity: 'error',
          message: `Nome "${name}" duplicado em ${ids.length} componentes da tela "${s.title || s.id}"`,
          screenId: s.id,
        });
      }
    }
  }

  // ----- 6.5 data_exchange sem endpoint configurado ------------------------
  const usesDataExchange = screens.some((s) =>
    s.components.some((c) => getAction(c)?.name === 'data_exchange')
  );
  if (usesDataExchange && (!dataChannelUri || !dataChannelUri.trim())) {
    problems.push({
      code: 'data-exchange-no-endpoint',
      severity: 'error',
      message:
        'Flow usa action "data_exchange" mas sem endpoint configurado (data_channel_uri). Configure a URL nas propriedades do Flow.',
    });
  }

  // ----- 7. Image sem src --------------------------------------------------
  for (const s of screens) {
    for (const c of s.components) {
      if (c.type === 'Image' && !c.src) {
        problems.push({
          code: 'image-no-src',
          severity: 'warning',
          message: 'Image sem URL — não vai renderizar no Flow',
          screenId: s.id,
          componentId: c.id,
        });
      }
    }
  }

  return problems;
}

// ============================================================================
// Helpers
// ============================================================================

/** Extrai a action de um component que tem onClickAction. */
function getAction(c: WhatsAppFlowComponent) {
  if (c.type === 'Footer' || c.type === 'EmbeddedLink') return c.onClickAction;
  if (c.type === 'OptIn') return c.onClickAction;
  return undefined;
}

function getComponentLabel(c: WhatsAppFlowComponent): string {
  if ('label' in c && typeof c.label === 'string') return c.label;
  if ('text' in c && typeof c.text === 'string') return c.text.slice(0, 30);
  return c.type;
}

/** BFS a partir da entry. Retorna set de screen IDs alcançáveis. */
function reachableFrom(
  startId: string,
  screens: WhatsAppFlowScreen[]
): Set<string> {
  const byId = new Map(screens.map((s) => [s.id, s]));
  const seen = new Set<string>([startId]);
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const s = byId.get(id);
    if (!s) continue;
    for (const c of s.components) {
      const action = getAction(c);
      if (action?.name === 'navigate') {
        const next = action.next.name;
        if (!seen.has(next) && byId.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  }
  return seen;
}
