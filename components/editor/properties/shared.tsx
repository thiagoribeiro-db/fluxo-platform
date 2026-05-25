'use client';

/**
 * Helpers UI compartilhados pelos editors de propriedade (NodeFields).
 *
 *  - inputCls: className padrão pros <input>/<textarea>
 *  - Field: wrapper de label + input
 *  - Badge: tag de tipo (acima do campo)
 *  - StableIdField: input read-only do ID estável (uuid do node)
 *  - FrameTargetSelect: dropdown de frames pro direcionamento
 *  - BlockTargetSelect: dropdown de blocos do frame alvo
 *  - FieldsListEditor: editor de array { label, key, value } (Notification)
 *  - OptionsListEditor: editor de array de strings (Menu)
 *
 * Separado pra que o NodeFields.tsx fique só com a lógica de switch
 * por tipo, sem o ruído dos helpers de UI.
 */

import { useState } from 'react';
import type { FluxoNode } from '@/lib/types';
import type { FlowVariable } from '@/lib/variables/extract-variables';

// ---- Editor de lista de campos (Notification) ------------------------------
export function FieldsListEditor({
  fields,
  onChange,
}: {
  fields: Array<{ label: string; key: string; value: string }>;
  onChange: (next: Array<{ label: string; key: string; value: string }>) => void;
}) {
  function update(idx: number, patch: Partial<{ label: string; key: string; value: string }>) {
    const next = [...fields];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function remove(idx: number) {
    onChange(fields.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }
  function add() {
    onChange([...fields, { label: 'Novo campo', key: `campo${fields.length + 1}`, value: '' }]);
  }

  return (
    <div className="space-y-2">
      {fields.map((f, idx) => (
        <div
          key={idx}
          className="border border-gray-200 dark:border-gray-700 rounded-md p-2 space-y-1.5 bg-gray-50 dark:bg-gray-800/40"
        >
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={f.label}
              onChange={(e) => update(idx, { label: e.target.value })}
              placeholder="Label"
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="text-gray-400 dark:text-gray-500 hover:text-blip-purple px-1 disabled:opacity-30"
              title="Subir"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(idx, 1)}
              disabled={idx === fields.length - 1}
              className="text-gray-400 dark:text-gray-500 hover:text-blip-purple px-1 disabled:opacity-30"
              title="Descer"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-gray-400 dark:text-gray-500 hover:text-red-600 px-1"
              title="Remover"
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            value={f.value}
            onChange={(e) => update(idx, { value: e.target.value })}
            placeholder="Valor (use {placeholder} se for variável)"
            className={`${inputCls} text-xs`}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full px-2 py-1.5 text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 hover:bg-blip-purple/5 dark:hover:bg-blip-purple/10 hover:text-blip-purple hover:border-blip-purple"
      >
        + Adicionar campo
      </button>
    </div>
  );
}

// =============================================================================
// Sub-componentes utilitários
// =============================================================================
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-blip-purple/10 dark:bg-blip-purple/20 text-blip-purple dark:text-blip-purple text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded">
      {children}
    </span>
  );
}

export const inputCls =
  'w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-md focus:border-blip-purple focus:outline-none focus:ring-2 focus:ring-blip-purple/20';

// ---- Stable ID copiável ----------------------------------------------------
export function StableIdField({ nodeId }: { nodeId: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(nodeId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex items-center gap-1 mt-1">
      <input
        readOnly
        value={nodeId}
        className="flex-1 text-[10px] font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5"
        onClick={(e) => (e.target as HTMLInputElement).select()}
        title="ID estável (não muda em renomeação)"
      />
      <button
        type="button"
        onClick={handleCopy}
        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium whitespace-nowrap"
        title="Copiar ID estável"
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  );
}

// ---- Frame target select (dropdown puro de frames disponíveis) -------------
/**
 * Dropdown que lista todos os frames do fluxo, usado pelo Direcionamento
 * pra selecionar `targetFrameId` (frameId humano/slug). Mostra
 * `[PREFIX] Título (frame_id)` pra facilitar identificação.
 *
 * Padrão: mesmo estilo que `AddConnectionSelect` (pai/filho) — select puro,
 * sem modo de digitação manual. Se o valor atual não estiver na lista
 * (referência a frame removido ou ainda inexistente), aparece como opção
 * destacada com "(não existe ainda)" pro usuário ver e corrigir.
 */
export function FrameTargetSelect({
  value,
  allNodes,
  onChange,
}: {
  value: string;
  allNodes: FluxoNode[];
  onChange: (v: string) => void;
}) {
  const frames = allNodes
    .filter((n) => n.type === 'frame')
    .map((n) => ({
      frameId: (n.data?.frameId as string | undefined) ?? '',
      title: (n.data?.title as string | undefined) ?? 'Sem título',
      prefix: (n.data?.prefix as string | undefined) ?? '',
    }))
    .filter((f) => f.frameId);

  const valueInList = value !== '' && frames.some((f) => f.frameId === value);

  return (
    <div className="space-y-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} font-mono`}
      >
        <option value="">— Selecione um frame —</option>
        {frames.map((f) => (
          <option key={f.frameId} value={f.frameId}>
            {f.prefix ? `[${f.prefix}] ` : ''}{f.title} ({f.frameId})
          </option>
        ))}
        {value !== '' && !valueInList && (
          <option value={value} disabled>
            ⚠️ {value} (frame não existe)
          </option>
        )}
      </select>
      {frames.length === 0 && (
        <p className="text-[10px] text-amber-700 dark:text-amber-400">
          Nenhum frame com `frameId` definido no fluxo. Defina o frameId nos frames primeiro.
        </p>
      )}
    </div>
  );
}

// ---- Block target select (dropdown de blocos dentro do frame selecionado) --
/**
 * Dropdown SECUNDÁRIO usado pelo Direcionamento — depois de escolher o frame,
 * permite escolher um BLOCO específico dentro dele (ex: "S005").
 *
 * "Bloco" aqui = qualquer node cuja posição absoluta cai dentro dos bounds
 * do frame selecionado, EXCETO o próprio frame, trackings, exceções (children
 * visuais) e o segundo handle bot/menu não-clicável.
 *
 * Opcional — se deixar "—", o direcionamento aponta pro frame inteiro
 * (handleJumpToFrame centraliza no frame).
 *
 * Armazena o `node.id` ESTÁVEL do bloco em `targetNodeId` (não muda em rename).
 */
export function BlockTargetSelect({
  value,
  targetFrameId,
  allNodes,
  onChange,
}: {
  value: string;
  targetFrameId: string;
  allNodes: FluxoNode[];
  onChange: (v: string) => void;
}) {
  // Sem frame selecionado, não tem o que listar
  if (!targetFrameId) {
    return (
      <p className="text-[11px] text-gray-400 dark:text-gray-500 italic px-2 py-1">
        Selecione um frame primeiro pra ver os blocos disponíveis.
      </p>
    );
  }

  // Acha o frame pelo data.frameId (slug humano)
  const frame = allNodes.find(
    (n) => n.type === 'frame' && n.data?.frameId === targetFrameId
  );

  if (!frame) {
    return (
      <p className="text-[11px] text-amber-700 dark:text-amber-400 italic px-2 py-1">
        Frame &quot;{targetFrameId}&quot; não encontrado no fluxo.
      </p>
    );
  }

  // Bounds do frame pra detectar blocos contidos
  const fw =
    frame.measured?.width ??
    (frame.data?.width as number | undefined) ??
    540;
  const fh =
    frame.measured?.height ??
    (frame.data?.height as number | undefined) ??
    400;
  const fLeft = frame.position.x;
  const fTop = frame.position.y;
  const fRight = fLeft + fw;
  const fBottom = fTop + fh;

  // Tipos excluídos da lista (não são "blocos endereçáveis")
  const skipTypes = new Set<string>([
    'frame',
    'tracking',
    'excecao',
    'btn-short', // botões em row geralmente não são alvos diretos de jump
  ]);

  // Filtra blocos cuja POSIÇÃO ABSOLUTA cai dentro dos bounds do frame
  const blocks = allNodes
    .filter((n) => !skipTypes.has(n.type ?? ''))
    .filter((n) => n.id !== frame.id)
    .filter((n) => {
      const cx = n.position.x + (n.measured?.width ?? 50);
      const cy = n.position.y + (n.measured?.height ?? 25);
      return cx >= fLeft && cx <= fRight && cy >= fTop && cy <= fBottom;
    })
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

  const valueInList = value !== '' && blocks.some((b) => b.id === value);

  return (
    <div className="space-y-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} font-mono text-xs`}
      >
        <option value="">— Frame inteiro (sem bloco específico) —</option>
        {blocks.map((b) => {
          const code = (b.data?.code as string | undefined) ?? '';
          const label =
            (b.data?.label as string | undefined) ??
            (b.data?.text as string | undefined) ??
            (b.data?.header as string | undefined) ??
            (b.data?.title as string | undefined) ??
            (b.data?.caption as string | undefined) ??
            (b.data?.linkTitle as string | undefined) ??
            '';
          const short = label.slice(0, 35);
          const display = code
            ? `${code} · ${short || b.type}`
            : `[${b.type}] ${short || b.id}`;
          return (
            <option key={b.id} value={b.id}>
              {display}
            </option>
          );
        })}
        {value !== '' && !valueInList && (
          <option value={value} disabled>
            ⚠️ bloco não encontrado (foi removido?)
          </option>
        )}
      </select>
      {blocks.length === 0 && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400">
          Nenhum bloco dentro desse frame ainda.
        </p>
      )}
    </div>
  );
}

// Sub-componentes de Properties extraídos pra :
//   - ConnectionsSection (com ConnectionItem, AddConnectionSelect, labelOf)
//   - ParentRelationSection + FrameContentsSection (RelationSections.tsx)

// ---- Editor de lista de opções (menu) -------------------------------------
export function OptionsListEditor({
  options,
  onChange,
  variables,
}: {
  options: string[];
  onChange: (next: string[]) => void;
  variables?: FlowVariable[];
}) {
  const [newOpt, setNewOpt] = useState('');

  function update(idx: number, value: string) {
    const next = [...options];
    next[idx] = value;
    onChange(next);
  }
  function remove(idx: number) {
    onChange(options.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }
  function add() {
    if (!newOpt.trim()) return;
    onChange([...options, newOpt.trim()]);
    setNewOpt('');
  }

  return (
    <div className="space-y-1.5">
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-start gap-1">
          <div className="flex-1">
            {/* Plain input — WhatsApp lista não suporta markdown nos itens,
                então não faz sentido oferecer toolbar de bold/italic/cor/etc. */}
            <input
              type="text"
              value={opt}
              onChange={(e) => update(idx, e.target.value)}
              placeholder="Texto da opção"
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={() => move(idx, -1)}
            disabled={idx === 0}
            className="text-gray-400 dark:text-gray-500 hover:text-blip-purple px-1 disabled:opacity-30"
            title="Subir"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(idx, 1)}
            disabled={idx === options.length - 1}
            className="text-gray-400 dark:text-gray-500 hover:text-blip-purple px-1 disabled:opacity-30"
            title="Descer"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => remove(idx)}
            className="text-gray-400 dark:text-gray-500 hover:text-red-600 px-1"
            title="Remover"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex items-center gap-1 pt-1">
        <input
          type="text"
          value={newOpt}
          onChange={(e) => setNewOpt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Nova opção…"
          className={`${inputCls} flex-1`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!newOpt.trim()}
          className="px-2 py-1 bg-blip-purple text-white text-sm rounded-md hover:bg-blip-purple-dark disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
