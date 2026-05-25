'use client';

/**
 * NodeFields — renderiza os campos editáveis de UM node selecionado no
 * PropertiesPanel. Switch grande por `node.type` que conhece todos os
 * tipos de bloco do Fluxo Platform.
 *
 * Helpers (Field, Badge, StableIdField, FrameTargetSelect,
 * BlockTargetSelect, FieldsListEditor, OptionsListEditor) ficam em
 * `properties/shared.tsx` pra reuso e split.
 */

import { useMemo } from 'react';
import type { FluxoNode, FluxoNodeData } from '@/lib/types';
import ApiMockEditor from '../ApiMockEditor';
import RichTextEditor from '../RichTextEditor';
import {
  extractVariables,
  type FlowVariable,
} from '@/lib/variables/extract-variables';
import {
  inputCls,
  Field,
  Badge,
  StableIdField,
  FrameTargetSelect,
  BlockTargetSelect,
  FieldsListEditor,
  OptionsListEditor,
} from './shared';

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
