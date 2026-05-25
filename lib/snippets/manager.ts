/**
 * Snippets de texto reusáveis — biblioteca por usuário (localStorage).
 *
 * Casos comuns: "Olá! Sou o assistente da {empresa}", "Obrigado pelo
 * contato!", "Em que posso ajudar?" — frases que o copywriter usa
 * em vários projetos e prefere não redigitar.
 *
 * Escopo: por USUÁRIO (localStorage), não por org/projeto. Quem quer
 * compartilhar copia pelo módulo de "Snippets da org" (futuro,
 * Tier D fase 2). Por agora, simples e funcional.
 *
 * API pura — qualquer componente importa e usa.
 */

const STORAGE_KEY = 'fluxo:snippets:v1';

export interface Snippet {
  /** ID interno (uuid-ish). Não exibido. */
  id: string;
  /** Nome curto pra UI — ex: "Saudação genérica". */
  name: string;
  /** Conteúdo de texto (markdown WhatsApp permitido). */
  body: string;
  /** Timestamp epoch ms — pra ordenar por "última editada". */
  updatedAt: number;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function listSnippets(): Snippet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is Snippet =>
          typeof s?.id === 'string' &&
          typeof s?.name === 'string' &&
          typeof s?.body === 'string'
      )
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [];
  }
}

function persistList(list: Snippet[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function createSnippet(name: string, body: string): Snippet {
  const list = listSnippets();
  const snip: Snippet = {
    id: newId(),
    name: name.trim() || 'Sem nome',
    body,
    updatedAt: Date.now(),
  };
  list.unshift(snip);
  persistList(list);
  return snip;
}

export function updateSnippet(
  id: string,
  patch: Partial<Pick<Snippet, 'name' | 'body'>>
): Snippet | null {
  const list = listSnippets();
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const next: Snippet = {
    ...list[idx],
    ...(patch.name !== undefined ? { name: patch.name.trim() || 'Sem nome' } : {}),
    ...(patch.body !== undefined ? { body: patch.body } : {}),
    updatedAt: Date.now(),
  };
  list[idx] = next;
  persistList(list);
  return next;
}

export function deleteSnippet(id: string): boolean {
  const list = listSnippets();
  const filtered = list.filter((s) => s.id !== id);
  if (filtered.length === list.length) return false;
  persistList(filtered);
  return true;
}

/**
 * Filtra por substring no nome OU body (case-insensitive).
 */
export function searchSnippets(query: string): Snippet[] {
  const list = listSnippets();
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.body.toLowerCase().includes(q)
  );
}
