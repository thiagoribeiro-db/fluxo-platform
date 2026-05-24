'use client';

/**
 * ApiMockEditor — editor inline de request/response pro nó `integracao-api`.
 *
 * Renderizado dentro do PropertiesPanel quando o nó selecionado é uma
 * integração de API. Permite ao designer:
 *
 *   • Definir o REQUEST que vai ser feito em runtime:
 *     - method (GET/POST/PUT/DELETE/PATCH)
 *     - URL (com suporte a placeholders {variavel})
 *     - headers (key/value)
 *     - body (JSON livre)
 *
 *   • Definir um RESPONSE MOCK pro Playback (Test Playground):
 *     - status HTTP (default 200)
 *     - body JSON que o flow-runner usa como se a API tivesse respondido
 *
 *   • Botão "🧪 Testar request real" — opcional, envia o request de verdade
 *     e popula o response mock com o resultado (best-effort, pode falhar
 *     por CORS em dev — útil só pra APIs públicas).
 *
 * Os dados ficam em `node.data` nas chaves:
 *   apiMethod, apiUrl, apiHeaders, apiBody, apiMockStatus, apiMockResponse
 *
 * Sem validação rigorosa de JSON — o user é livre pra digitar qualquer
 * coisa. Validação visual (border vermelho) apenas com hint.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Play, Plus, Trash2 } from 'lucide-react';
import type { FluxoNodeData } from '@/lib/types';
import { toast } from '@/lib/utils/errors';

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiHeader {
  key: string;
  value: string;
}

interface ApiMockEditorProps {
  data: FluxoNodeData;
  onUpdate: (patch: Partial<FluxoNodeData>) => void;
}

const METHODS: ApiMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const methodColors: Record<ApiMethod, string> = {
  GET: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  POST: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  PUT: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
  PATCH: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
  DELETE: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
};

const inputCls =
  'w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-md focus:border-blip-purple focus:outline-none focus:ring-2 focus:ring-blip-purple/20';

export default function ApiMockEditor({ data, onUpdate }: ApiMockEditorProps) {
  const method = (data.apiMethod as ApiMethod | undefined) ?? 'GET';
  const url = (data.apiUrl as string | undefined) ?? '';
  const headers = (data.apiHeaders as ApiHeader[] | undefined) ?? [];
  const body = (data.apiBody as string | undefined) ?? '';
  const mockStatus = (data.apiMockStatus as number | undefined) ?? 200;
  const mockResponse = (data.apiMockResponse as string | undefined) ?? '';

  const [requestOpen, setRequestOpen] = useState(true);
  const [responseOpen, setResponseOpen] = useState(true);
  const [testing, setTesting] = useState(false);

  // ---- Helpers de update -------------------------------------------------

  function updateHeader(idx: number, patch: Partial<ApiHeader>) {
    const next = [...headers];
    next[idx] = { ...next[idx], ...patch };
    onUpdate({ apiHeaders: next });
  }

  function addHeader() {
    onUpdate({
      apiHeaders: [...headers, { key: '', value: '' }],
    });
  }

  function removeHeader(idx: number) {
    onUpdate({ apiHeaders: headers.filter((_, i) => i !== idx) });
  }

  // ---- Testar request real -----------------------------------------------
  // Atalho: envia o request configurado e popula o mock com o resultado.
  // Útil pra APIs públicas. Pode falhar por CORS — best-effort.

  async function testRequest() {
    if (!url.trim()) {
      toast({ level: 'warn', message: 'Defina a URL primeiro' });
      return;
    }
    setTesting(true);
    try {
      const headersObj: Record<string, string> = {};
      for (const h of headers) {
        if (h.key.trim()) headersObj[h.key.trim()] = h.value;
      }
      const init: RequestInit = { method };
      if (method !== 'GET' && body.trim()) {
        init.body = body;
        if (!headersObj['Content-Type'] && !headersObj['content-type']) {
          headersObj['Content-Type'] = 'application/json';
        }
      }
      init.headers = headersObj;

      const res = await fetch(url, init);
      const text = await res.text();
      // Tenta formatar JSON
      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* deixa como veio */
      }
      onUpdate({
        apiMockStatus: res.status,
        apiMockResponse: formatted,
      });
      toast({
        level: res.ok ? 'success' : 'warn',
        message: `Mock atualizado (HTTP ${res.status})`,
      });
    } catch (err) {
      toast({
        level: 'error',
        message: 'Falha no request',
        detail:
          err instanceof Error
            ? err.message
            : 'Erro desconhecido (pode ser CORS — comum em dev local)',
      });
    } finally {
      setTesting(false);
    }
  }

  const isValidJson = (s: string): boolean => {
    const trimmed = s.trim();
    if (!trimmed) return true; // vazio é OK
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  };

  const bodyValid = method === 'GET' || isValidJson(body);
  const mockValid = isValidJson(mockResponse);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4 space-y-3">
      {/* ========================== REQUEST ============================ */}
      <section>
        <button
          type="button"
          onClick={() => setRequestOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 hover:text-gray-800 dark:hover:text-gray-200"
        >
          {requestOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Request
        </button>

        {requestOpen && (
          <div className="space-y-2.5">
            {/* Method + URL na mesma linha */}
            <div className="flex items-center gap-1.5">
              <select
                value={method}
                onChange={(e) =>
                  onUpdate({ apiMethod: e.target.value as ApiMethod })
                }
                className={`text-xs font-mono font-bold px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 ${methodColors[method]}`}
                title="Método HTTP"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={url}
                onChange={(e) => onUpdate({ apiUrl: e.target.value })}
                placeholder="https://api.exemplo.com/v1/clientes/{cpf}"
                className={`${inputCls} font-mono text-xs flex-1`}
              />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 -mt-1.5 px-0.5">
              Use <code className="bg-gray-100 dark:bg-gray-800 px-0.5 rounded">{`{var}`}</code> pra placeholders (substituídos em runtime)
            </p>

            {/* Headers */}
            <div>
              <label className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Headers
              </label>
              <div className="space-y-1 mt-1">
                {headers.length === 0 && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 italic px-2 py-1">
                    Sem headers customizados
                  </p>
                )}
                {headers.map((h, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={h.key}
                      onChange={(e) => updateHeader(idx, { key: e.target.value })}
                      placeholder="Authorization"
                      className={`${inputCls} font-mono text-xs flex-1 min-w-0`}
                    />
                    <span className="text-gray-400 dark:text-gray-500">:</span>
                    <input
                      type="text"
                      value={h.value}
                      onChange={(e) => updateHeader(idx, { value: e.target.value })}
                      placeholder="Bearer {token}"
                      className={`${inputCls} font-mono text-xs flex-1 min-w-0`}
                    />
                    <button
                      type="button"
                      onClick={() => removeHeader(idx)}
                      className="shrink-0 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 px-1"
                      title="Remover header"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addHeader}
                  className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 hover:bg-blip-purple/5 dark:hover:bg-blip-purple/10 hover:text-blip-purple hover:border-blip-purple"
                >
                  <Plus size={11} /> Adicionar header
                </button>
              </div>
            </div>

            {/* Body — só se não for GET */}
            {method !== 'GET' && (
              <div>
                <label className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center justify-between">
                  <span>Body (JSON)</span>
                  {!bodyValid && (
                    <span className="text-red-600 dark:text-red-400 text-[10px] normal-case font-normal">
                      ⚠ JSON inválido
                    </span>
                  )}
                </label>
                <textarea
                  value={body}
                  onChange={(e) => onUpdate({ apiBody: e.target.value })}
                  placeholder={`{\n  "cpf": "{cpf}",\n  "produto": "premium"\n}`}
                  rows={5}
                  className={`${inputCls} font-mono text-xs resize-y ${!bodyValid ? 'border-red-400 dark:border-red-700' : ''}`}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================== RESPONSE MOCK ====================== */}
      <section>
        <button
          type="button"
          onClick={() => setResponseOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 hover:text-gray-800 dark:hover:text-gray-200"
        >
          {responseOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Response Mock
          <span className="ml-1 text-[10px] font-normal lowercase tracking-normal text-gray-400 dark:text-gray-500">
            (usado no Test Playground)
          </span>
        </button>

        {responseOpen && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <label className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 shrink-0">
                Status HTTP
              </label>
              <input
                type="number"
                value={mockStatus}
                onChange={(e) =>
                  onUpdate({ apiMockStatus: Number(e.target.value) || 200 })
                }
                min="100"
                max="599"
                className={`${inputCls} font-mono text-xs w-20`}
              />
              <button
                type="button"
                onClick={testRequest}
                disabled={testing || !url.trim()}
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md text-blip-purple hover:bg-blip-purple/10 dark:hover:bg-blip-purple/20 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Envia o request configurado e popula o mock com a resposta real"
              >
                <Play size={11} /> {testing ? 'Testando…' : 'Testar request real'}
              </button>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center justify-between">
                <span>Body do mock (JSON)</span>
                {!mockValid && (
                  <span className="text-red-600 dark:text-red-400 text-[10px] normal-case font-normal">
                    ⚠ JSON inválido
                  </span>
                )}
              </label>
              <textarea
                value={mockResponse}
                onChange={(e) => onUpdate({ apiMockResponse: e.target.value })}
                placeholder={`{\n  "id": 123,\n  "nome": "João",\n  "saldo": 1500\n}`}
                rows={8}
                className={`${inputCls} font-mono text-xs resize-y ${!mockValid ? 'border-red-400 dark:border-red-700' : ''}`}
              />
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                O Playback usa esse JSON como resposta da API — sem rodar request real.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
