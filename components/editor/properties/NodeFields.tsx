'use client';

/**
 * NodeFields — renderiza os campos editáveis de UM node selecionado no
 * PropertiesPanel. Switch grande por `node.type` que conhece todos os
 * tipos de bloco do Fluxo Platform.
 *
 * Inclui helpers internos:
 *  - Field: wrapper de label + input
 *  - Badge: tag pequena (tipo do node)
 *  - StableIdField: input read-only do ID estável
 *  - FrameTargetSelect: dropdown de frames pra direcionamento
 *  - BlockTargetSelect: dropdown de blocos pra direcionamento de nó
 *  - FieldsListEditor: editor de array de campos (notificação)
 *  - OptionsListEditor: editor de opções de menu
 *
 * Movido pra arquivo próprio na rodada de refator do Onda 4+.
 */

import { useMemo, useState } from 'react';
import type { FluxoNode, FluxoNodeData } from '@/lib/types';
import ApiMockEditor from '../ApiMockEditor';
import RichTextEditor from '../RichTextEditor';
import {
  extractVariables,
  type FlowVariable,
} from '@/lib/variables/extract-variables';

export function NodeFields({
  node,
  onUpdate,
  allNodesForSelect,
}: {
  node: FluxoNode;
  onUpdate: (patch: Partial<FluxoNodeData>) => void;
  /** Lista de todos os nodes — usado pra montar dropdowns (frames disponíveis). */
  allNodesForSelect: FluxoNode[];
}) {
  const data = node.data;
  // Variáveis declaradas no fluxo — alimenta o popover `{{...}}` do RichTextEditor.
  const variables = useMemo<FlowVariable[]>(
    () => extractVariables(allNodesForSelect),
    [allNodesForSelect]
  );

  return (
    <div className="space-y-4">
      <div>
        <Badge>{node.type}</Badge>
        <StableIdField nodeId={node.id} />
      </div>

      <Field label="ID do bloco (code)">
        <input
          type="text"
          value={data.code ?? ''}
          onChange={(e) => onUpdate({ code: e.target.value })}
          placeholder="ex: B001"
          className={`${inputCls} font-mono uppercase`}
        />
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
          Pode renomear sem perder as conexões — referências usam o ID estável.
        </p>
      </Field>

      {node.type === 'frame' && (
        <>
          <label
            className={`flex items-center gap-2 text-sm cursor-pointer select-none rounded-md px-2.5 py-2 border ${
              data.locked
                ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                : 'bg-blip-purple/5 dark:bg-blip-purple/10 border-blip-purple/20 text-gray-700 dark:text-gray-200'
            }`}
          >
            <input
              type="checkbox"
              checked={!!data.locked}
              onChange={(e) => onUpdate({ locked: e.target.checked })}
              className="rounded border-gray-300 text-blip-purple focus:ring-blip-purple"
            />
            <span className="flex-1 font-medium">
              {data.locked ? '🔒 Frame travado' : '🔓 Frame destravado'}
            </span>
          </label>
          {data.locked && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-2">
              Não pode mover, redimensionar ou apagar. Destrave para editar.
            </p>
          )}

          <Field label="Título">
            <input
              type="text"
              value={data.title ?? ''}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Prefixo dos IDs dos blocos contidos">
            <input
              type="text"
              value={data.prefix ?? ''}
              onChange={(e) =>
                onUpdate({ prefix: e.target.value.toUpperCase() })
              }
              placeholder="ex: S, O, T, E, AM, MP"
              className={`${inputCls} font-mono uppercase`}
              maxLength={4}
            />
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
              Blocos dentro deste frame ficam tipo <code>{(data.prefix || 'X')}001</code>,{' '}
              <code>{(data.prefix || 'X')}002</code>…
            </p>
          </Field>
          <Field label="Frame ID (anchor)">
            <input
              type="text"
              value={data.frameId ?? ''}
              onChange={(e) => onUpdate({ frameId: e.target.value })}
              placeholder="ex: saudacao"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Largura">
              <input
                type="number"
                value={data.width ?? 540}
                onChange={(e) => onUpdate({ width: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label="Altura">
              <input
                type="number"
                value={data.height ?? 400}
                onChange={(e) => onUpdate({ height: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
          </div>
        </>
      )}

      {node.type === 'bubble-bot' && (
        <Field label="Texto da mensagem">
          <RichTextEditor
            value={(data.text as string | undefined) ?? ''}
            onChange={(text) => onUpdate({ text })}
            placeholder="Digite a mensagem do bot…"
            minHeight={110}
            variables={variables}
          />
        </Field>
      )}

      {node.type === 'bubble-user' && (
        <Field label="Texto da mensagem">
          <textarea
            value={data.text ?? ''}
            onChange={(e) => onUpdate({ text: e.target.value })}
            rows={5}
            className={`${inputCls} resize-none`}
          />
        </Field>
      )}

      {(node.type === 'btn-short' ||
        node.type === 'btn-long' ||
        node.type === 'tracking' ||
        node.type === 'excecao') && (
        <Field label="Label">
          <input
            type="text"
            value={data.label ?? ''}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className={inputCls}
          />
        </Field>
      )}

      {node.type === 'menu' && (
        <>
          <Field label="Header">
            <RichTextEditor
              value={(data.header as string | undefined) ?? ''}
              onChange={(header) => onUpdate({ header })}
              placeholder="Texto do cabeçalho do menu"
              minHeight={50}
              singleLine
              variables={variables}
            />
          </Field>
          <Field label="Opções">
            <OptionsListEditor
              options={data.options ?? []}
              onChange={(options) => onUpdate({ options })}
              variables={variables}
            />
          </Field>
          <Field label="Footer (texto do botão)">
            <input
              type="text"
              value={data.footer ?? ''}
              onChange={(e) => onUpdate({ footer: e.target.value })}
              placeholder="Enviar"
              className={inputCls}
            />
          </Field>
        </>
      )}

      {node.type === 'direcionamento' && (
        <>
          <Field label="Label">
            <input
              type="text"
              value={data.label ?? ''}
              onChange={(e) => onUpdate({ label: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Frame de destino">
            <FrameTargetSelect
              value={(data.targetFrameId as string | undefined) ?? ''}
              allNodes={allNodesForSelect}
              onChange={(v) =>
                // Trocar de frame → limpa targetNodeId (bloco específico)
                // porque o bloco antigo provavelmente não existe no novo frame
                onUpdate({ targetFrameId: v, targetNodeId: undefined })
              }
            />
          </Field>
          <Field label="Bloco específico (opcional)">
            <BlockTargetSelect
              value={(data.targetNodeId as string | undefined) ?? ''}
              targetFrameId={(data.targetFrameId as string | undefined) ?? ''}
              allNodes={allNodesForSelect}
              onChange={(v) => onUpdate({ targetNodeId: v })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!data.clickable}
              onChange={(e) => onUpdate({ clickable: e.target.checked })}
              className="rounded border-gray-300 dark:border-gray-600 text-blip-purple focus:ring-blip-purple"
            />
            <span>Clicável (anima ao passar mouse)</span>
          </label>
        </>
      )}

      {/* ===== NOTIFICATION (integrações, IAG) ===== */}
      {(node.type === 'integracao-api' ||
        node.type === 'integracao-planilha' ||
        node.type === 'iag-entrada' ||
        node.type === 'iag-reentrada' ||
        node.type === 'iag-saida') && (
        <>
          <Field label="Título do header">
            <input
              type="text"
              value={data.title ?? ''}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Cor do header">
              <input
                type="text"
                value={data.headerColor ?? '#6F2DBD'}
                onChange={(e) => onUpdate({ headerColor: e.target.value })}
                placeholder="#6F2DBD"
                className={`${inputCls} font-mono`}
              />
            </Field>
            <Field label="Ícone">
              <input
                type="text"
                value={data.headerIcon ?? ''}
                onChange={(e) => onUpdate({ headerIcon: e.target.value })}
                placeholder="🤖"
                className={`${inputCls} w-16 text-center`}
                maxLength={4}
              />
            </Field>
          </div>
          <Field label="Campos do bloco">
            <FieldsListEditor
              fields={data.fields ?? []}
              onChange={(next) => onUpdate({ fields: next })}
            />
          </Field>

          {/* Editor de Request/Response Mock — só pra integracao-api */}
          {node.type === 'integracao-api' && (
            <ApiMockEditor data={data} onUpdate={onUpdate} />
          )}
        </>
      )}

      {/* ===== ATENDIMENTO HUMANO (transbordo terminal) ===== */}
      {node.type === 'atendimento-humano' && (
        <>
          <Field label="Label exibido">
            <input
              type="text"
              value={data.label ?? ''}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Atendimento humano"
              className={inputCls}
            />
          </Field>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            🟠 Marca o ponto onde o fluxo automatizado TERMINA e um humano assume.
          </p>
        </>
      )}

      {/* ===== CONDICIONAL (decisão if/else - varal) ===== */}
      {node.type === 'condicional' && (
        <>
          <Field label="Condição / Pergunta avaliada">
            <textarea
              value={data.condition ?? ''}
              onChange={(e) => onUpdate({ condition: e.target.value })}
              rows={2}
              placeholder="ex: Cliente é VIP?"
              className={`${inputCls} resize-none`}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Label TRUE (verde)">
              <input
                type="text"
                value={data.trueLabel ?? ''}
                onChange={(e) => onUpdate({ trueLabel: e.target.value })}
                placeholder="Verdadeiro"
                className={inputCls}
              />
            </Field>
            <Field label="Label FALSE (vermelho)">
              <input
                type="text"
                value={data.falseLabel ?? ''}
                onChange={(e) => onUpdate({ falseLabel: e.target.value })}
                placeholder="Falso"
                className={inputCls}
              />
            </Field>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            💡 Arraste das pontas verde (TRUE) e vermelha (FALSE) pra conectar os dois caminhos.
          </p>
        </>
      )}

      {/* ===== LINK (URL externa) ===== */}
      {node.type === 'link' && (
        <>
          <Field label="Remetente">
            <div className="flex gap-1">
              {(['bot', 'user'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onUpdate({ sender: s })}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium ${
                    (data.sender ?? 'bot') === s
                      ? 'bg-blip-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {s === 'bot' ? '🤖 BOT' : '👤 USER'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="URL">
            <input
              type="url"
              value={data.url ?? ''}
              onChange={(e) => onUpdate({ url: e.target.value })}
              placeholder="https://exemplo.com/pagina"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <Field label="Título do card">
            <input
              type="text"
              value={data.linkTitle ?? ''}
              onChange={(e) => onUpdate({ linkTitle: e.target.value })}
              placeholder="ex: Documentação Oficial"
              className={inputCls}
            />
          </Field>
          <Field label="Descrição (opcional)">
            <textarea
              value={data.linkDescription ?? ''}
              onChange={(e) => onUpdate({ linkDescription: e.target.value })}
              rows={2}
              placeholder="Breve descrição do conteúdo"
              className={`${inputCls} resize-none`}
            />
          </Field>
        </>
      )}

      {/* ===== MEDIA (imagem, documento, vídeo) ===== */}
      {(node.type === 'midia-imagem-bot' ||
        node.type === 'midia-imagem-user' ||
        node.type === 'midia-documento-bot' ||
        node.type === 'midia-documento-user' ||
        node.type === 'midia-video-bot' ||
        node.type === 'midia-video-user') && (
        <>
          <Field label="Remetente">
            <div className="flex gap-1">
              {(['bot', 'user'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onUpdate({ sender: s })}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium ${
                    (data.sender ?? 'bot') === s
                      ? 'bg-blip-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {s === 'bot' ? '🤖 BOT' : '👤 USER'}
                </button>
              ))}
            </div>
          </Field>
          {data.mediaKind === 'documento' ? (
            <>
              <Field label="Nome do arquivo">
                <input
                  type="text"
                  value={data.filename ?? ''}
                  onChange={(e) => onUpdate({ filename: e.target.value })}
                  placeholder="document.pdf"
                  className={inputCls}
                />
              </Field>
              <Field label="Metadata (tamanho, páginas)">
                <input
                  type="text"
                  value={data.meta ?? ''}
                  onChange={(e) => onUpdate({ meta: e.target.value })}
                  placeholder="1 page · 262 KB · pdf"
                  className={inputCls}
                />
              </Field>
            </>
          ) : (
            <Field label="Legenda">
              <textarea
                value={data.caption ?? ''}
                onChange={(e) => onUpdate({ caption: e.target.value })}
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </Field>
          )}
          <Field label="Thumbnail URL (opcional)">
            <input
              type="text"
              value={data.thumbnailUrl ?? ''}
              onChange={(e) => onUpdate({ thumbnailUrl: e.target.value })}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>
        </>
      )}
    </div>
  );
}

// ---- Editor de lista de campos (Notification) ------------------------------
function FieldsListEditor({
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
function Field({
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-blip-purple/10 dark:bg-blip-purple/20 text-blip-purple dark:text-blip-purple text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded">
      {children}
    </span>
  );
}

const inputCls =
  'w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-md focus:border-blip-purple focus:outline-none focus:ring-2 focus:ring-blip-purple/20';

// ---- Stable ID copiável ----------------------------------------------------
function StableIdField({ nodeId }: { nodeId: string }) {
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
function FrameTargetSelect({
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
function BlockTargetSelect({
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
function OptionsListEditor({
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
