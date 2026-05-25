/**
 * Helper de localStorage versionado + migrations.
 *
 * Problema que resolve:
 *  - localStorage tem chaves espalhadas (`fluxo:snippets:v1`, `fluxo:user-skills:v1`,
 *    sem padrão em outras). Se mudarmos formato, precisamos migrar dados existentes
 *    OU descartar — descobrir isso na hora é arriscado.
 *
 * Padrão:
 *  - Toda chave tem formato `fluxo:<feature>:v<N>`
 *  - `loadVersioned()` aceita lista de `migrations` que rodam em ordem
 *  - Versões antigas tentam ler `:v1`, `:v2`, etc. e migrar pro target
 *  - Falha silenciosa retorna `defaultValue`
 *
 * Uso:
 *
 *   const list = loadVersioned<Snippet[]>('snippets', 1, {
 *     defaultValue: [],
 *     // Sem migrations ainda (v1 é a primeira versão)
 *   });
 *
 *   saveVersioned('snippets', 1, list);
 *
 * Quando subir pra v2 (ex: rename campo):
 *
 *   loadVersioned<Snippet[]>('snippets', 2, {
 *     defaultValue: [],
 *     migrations: [
 *       (v1Data) => v1Data.map((x) => ({ ...x, novoCampo: '' })),
 *     ],
 *   });
 */

const KEY_PREFIX = 'fluxo';

function key(feature: string, version: number): string {
  return `${KEY_PREFIX}:${feature}:v${version}`;
}

/** Estado em runtime — usado por `loadVersioned` pra encontrar versões antigas. */
function listKeysFor(feature: string): Array<{ version: number; key: string }> {
  if (typeof window === 'undefined') return [];
  const out: Array<{ version: number; key: string }> = [];
  const re = new RegExp(`^${KEY_PREFIX}:${feature}:v(\\d+)$`);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const m = k.match(re);
    if (m) out.push({ version: parseInt(m[1], 10), key: k });
  }
  return out.sort((a, b) => a.version - b.version);
}

export interface LoadVersionedOpts<T> {
  /** Valor retornado se não há dado salvo ou se parse falha. */
  defaultValue: T;
  /**
   * Funções de migração — `migrations[i]` migra de v{i+1} pra v{i+2}.
   * Ex: migrations[0] migra v1 → v2; migrations[1] migra v2 → v3.
   * Devem ser idempotentes (rodar 2× retorna o mesmo).
   */
  migrations?: Array<(prev: unknown) => unknown>;
  /**
   * Validador opcional rodado depois de migrar. Se retorna false, descarta
   * dado corrompido e usa `defaultValue`.
   */
  validate?: (data: unknown) => boolean;
}

/**
 * Carrega `feature` versionada. Se chave da `targetVersion` existe, retorna.
 * Senão, tenta encontrar versão anterior e migra.
 */
export function loadVersioned<T>(
  feature: string,
  targetVersion: number,
  opts: LoadVersionedOpts<T>
): T {
  if (typeof window === 'undefined') return opts.defaultValue;

  // 1. Já tem na versão target? Retorna direto.
  const targetRaw = localStorage.getItem(key(feature, targetVersion));
  if (targetRaw) {
    try {
      const parsed = JSON.parse(targetRaw);
      if (opts.validate && !opts.validate(parsed)) return opts.defaultValue;
      return parsed as T;
    } catch {
      // Dado corrompido — limpa e cai pro default
      localStorage.removeItem(key(feature, targetVersion));
      return opts.defaultValue;
    }
  }

  // 2. Procura versão anterior (maior versão < targetVersion)
  const olderVersions = listKeysFor(feature).filter(
    (k) => k.version < targetVersion
  );
  if (olderVersions.length === 0) return opts.defaultValue;

  const newest = olderVersions[olderVersions.length - 1];
  let data: unknown;
  try {
    data = JSON.parse(localStorage.getItem(newest.key) ?? 'null');
    if (data === null) return opts.defaultValue;
  } catch {
    return opts.defaultValue;
  }

  // 3. Roda migrations em sequência: v{newest} → v{newest+1} → ... → v{target}
  const migrations = opts.migrations ?? [];
  for (let v = newest.version; v < targetVersion; v++) {
    const migration = migrations[v - 1]; // migrations[0] = v1→v2
    if (typeof migration !== 'function') {
      // Sem migration definida — não podemos pular versão. Retorna default.
      return opts.defaultValue;
    }
    try {
      data = migration(data);
    } catch {
      return opts.defaultValue;
    }
  }

  if (opts.validate && !opts.validate(data)) return opts.defaultValue;

  // 4. Persiste na versão target e remove a antiga (limpeza)
  saveVersioned(feature, targetVersion, data);
  // Limpa versões antigas — economia de espaço
  for (const old of olderVersions) {
    localStorage.removeItem(old.key);
  }

  return data as T;
}

/**
 * Salva dado na chave versionada. Falha silenciosa se localStorage cheio.
 */
export function saveVersioned(
  feature: string,
  version: number,
  data: unknown
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key(feature, version), JSON.stringify(data));
  } catch (err) {
    // localStorage cheio ou bloqueado — falha silenciosa, sem console.warn
    // pra não poluir Sentry/logs. Caller deve assumir best-effort.
    void err;
  }
}

/**
 * Remove todas as versões de uma feature. Útil pra logout/reset.
 */
export function clearVersioned(feature: string): void {
  if (typeof window === 'undefined') return;
  for (const k of listKeysFor(feature)) {
    localStorage.removeItem(k.key);
  }
}
