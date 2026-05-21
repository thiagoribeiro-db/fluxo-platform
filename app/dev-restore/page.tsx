'use client';

/**
 * Página DEV-ONLY pra restaurar um snapshot como nova página no projeto.
 *
 * Acesse autenticado (login normal) e clique no botão. Chama
 * `/api/dev/restore-snapshot` POST que lê `tmp/state-snapshot.json` e cria
 * uma página `[Restore DD/MM HH:MM] <nome>` no projeto referenciado pelo
 * snapshot (ou o projeto que você passar no input).
 *
 * Não está disponível em produção.
 */

import { useState } from 'react';

interface RestoreResult {
  ok?: boolean;
  pageId?: string;
  name?: string;
  projectId?: string;
  projectName?: string;
  nodesCount?: number;
  edgesCount?: number;
  snapshotTimestamp?: string;
  error?: string;
  details?: string;
}

export default function DevRestorePage() {
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);

  async function handleRestore() {
    setLoading(true);
    setResult(null);
    try {
      const body: Record<string, string> = {};
      if (projectId.trim()) body.projectId = projectId.trim();
      const res = await fetch('/api/dev/restore-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json: RestoreResult = await res.json();
      setResult(json);
    } catch (err) {
      setResult({
        error: 'Falha de rede',
        details: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          🛟 Restaurar snapshot (DEV)
        </h1>
        <p className="text-sm text-gray-600 mt-2">
          Lê <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">tmp/state-snapshot.json</code>{' '}
          e cria uma <strong>página nova</strong> no projeto com o state do
          snapshot. NÃO sobrescreve nada existente.
        </p>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700 mb-1 block">
            Project ID (opcional)
          </span>
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Deixe vazio pra usar o projeto do snapshot"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blip-purple/40 focus:border-blip-purple font-mono"
          />
          <span className="text-xs text-gray-500 mt-1 block">
            Se omitir, restaura no projeto referenciado pelo snapshot.
          </span>
        </label>

        <button
          type="button"
          onClick={handleRestore}
          disabled={loading}
          className="bg-blip-purple hover:bg-blip-purple-dark text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
        >
          {loading ? 'Restaurando…' : '🛟 Restaurar como nova página'}
        </button>
      </div>

      {result && (
        <div
          className={
            'rounded-lg border p-4 ' +
            (result.ok
              ? 'bg-green-50 border-green-300 text-green-900'
              : 'bg-red-50 border-red-300 text-red-900')
          }
        >
          {result.ok ? (
            <>
              <h2 className="font-semibold mb-2">✅ Restaurado!</h2>
              <ul className="text-sm space-y-1">
                <li>
                  <strong>Projeto:</strong> {result.projectName} (
                  <code className="text-xs">{result.projectId}</code>)
                </li>
                <li>
                  <strong>Página criada:</strong> {result.name}
                </li>
                <li>
                  <strong>ID:</strong>{' '}
                  <code className="text-xs">{result.pageId}</code>
                </li>
                <li>
                  <strong>Conteúdo:</strong> {result.nodesCount} nodes,{' '}
                  {result.edgesCount} edges
                </li>
                <li className="text-xs opacity-70">
                  Snapshot original: {result.snapshotTimestamp}
                </li>
              </ul>
              {result.projectId && (
                <a
                  href={`/editor/${result.projectId}`}
                  className="inline-block mt-3 text-sm underline text-green-700 hover:text-green-900"
                >
                  → Abrir editor do projeto
                </a>
              )}
            </>
          ) : (
            <>
              <h2 className="font-semibold mb-2">❌ Erro</h2>
              <p className="text-sm">{result.error}</p>
              {result.details && (
                <p className="text-xs opacity-70 mt-1">{result.details}</p>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}
