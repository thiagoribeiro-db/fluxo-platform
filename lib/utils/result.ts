/**
 * Tipo Result<T, E> — padrão pra retorno de operações que podem falhar.
 *
 * Usar em **server actions** novas em vez de `throw new Error(...)`. Razões:
 *  1. Caller sabe explicitamente que pode falhar (tipo carrega a possibilidade)
 *  2. Erro estruturado (`code` + `message` + payload opcional)
 *  3. Cliente pode tomar decisão diferente por code (ex: 'rate_limit' →
 *     mostra timer; 'not_found' → 404; 'unauthorized' → login)
 *  4. Logging fica mais consistente
 *
 * Padrão de uso:
 *
 *   export async function createComment(raw: unknown): Promise<Result<{id: string}>> {
 *     const parsed = CreateCommentInput.safeParse(raw);
 *     if (!parsed.success) return err('invalid_input', formatZodError(parsed.error).message);
 *     // ...
 *     return ok({ id: comment.id });
 *   }
 *
 *   // No client:
 *   const result = await createComment(input);
 *   if (!result.ok) {
 *     toast({ level: 'error', message: result.error.message });
 *     return;
 *   }
 *   // usa result.data.id
 *
 * Migração gradual: actions antigas continuam usando `throw`. Adotamos
 * Result em actions NOVAS ou ao refatorar uma existente.
 */

export type Ok<T> = { ok: true; data: T };
export type Err<E extends string = string> = {
  ok: false;
  error: {
    /** Slug estável pra diferenciar erros (ex: 'not_found', 'rate_limit'). */
    code: E;
    /** Mensagem amigável pro user. PT-BR. */
    message: string;
    /** Detalhes opcionais (ex: campos com erro de validação Zod). */
    details?: Record<string, unknown>;
  };
};

export type Result<T, E extends string = string> = Ok<T> | Err<E>;

/** Constrói um Ok. */
export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

/**
 * Constrói um Err. `code` é um slug curto e estável; `message` é amigável
 * pro user; `details` é opcional pra payload (ex: issues do Zod).
 */
export function err<E extends string>(
  code: E,
  message: string,
  details?: Record<string, unknown>
): Err<E> {
  return { ok: false, error: { code, message, details } };
}

/**
 * Códigos de erro recorrentes. Adicione novos aqui pra manter consistência.
 */
export const ErrorCodes = {
  INVALID_INPUT: 'invalid_input',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  UPSTREAM_ERROR: 'upstream_error',
  INTERNAL: 'internal',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
