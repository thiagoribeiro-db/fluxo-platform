'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';
import { markdownToHtml } from '@/lib/utils/markdown';

export interface MenuSection {
  title: string;
  options: string[];
  descriptions?: string[];
}

/**
 * Menu — modal de seleção do WhatsApp com header, lista de opções e footer.
 *
 * Suporta dois modos:
 *   - Flat: `data.options` (string[]) — lista simples sem agrupamento
 *   - Sectioned: `data.sections` (MenuSection[]) — opções agrupadas com cabeçalhos de seção
 *
 * Conexões: handle top (entrada), handle bottom (saída — usuário escolheu).
 */
function MenuNode({ data, selected }: NodeProps<FluxoNode>) {
  const header      = (data.header as string | undefined) || 'Selecione uma opção';
  const sections    = data.sections as MenuSection[] | undefined;
  const flatOptions = (data.options as string[] | undefined) || [];
  const flatDescs   = (data.optionDescriptions as string[] | undefined) || [];

  const hasSections = Array.isArray(sections) && sections.length > 0;

  return (
    <div className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}>
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div className="menu">
        <div
          className="menu-header"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(header) }}
        />

        {hasSections ? (
          /* ── Modo com seções ── */
          sections!.map((section, si) => (
            <div key={si}>
              <div className="menu-section-title">{section.title}</div>
              {section.options.map((opt, oi) => {
                const desc = section.descriptions?.[oi];
                return (
                  <div key={oi} className="menu-row">
                    <div className="flex-1 min-w-0">
                      <span
                        className="menu-row-label"
                        dangerouslySetInnerHTML={{ __html: markdownToHtml(opt) }}
                      />
                      {desc && <p className="menu-row-description">{desc}</p>}
                    </div>
                    <span className="menu-row-radio" />
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          /* ── Modo flat ── */
          (flatOptions.length > 0 ? flatOptions : ['Opção 1', 'Opção 2', 'Opção 3']).map(
            (opt, idx) => {
              const desc = flatDescs[idx];
              return (
                <div key={idx} className="menu-row">
                  <div className="flex-1 min-w-0">
                    <span
                      className="menu-row-label"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(opt) }}
                    />
                    {desc && <p className="menu-row-description">{desc}</p>}
                  </div>
                  <span className="menu-row-radio" />
                </div>
              );
            }
          )
        )}

        <div className="menu-footer">{(data.footer as string | undefined) || 'Enviar'}</div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(MenuNode);
