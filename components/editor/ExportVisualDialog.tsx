'use client';

import { useState, useTransition } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  exportFrames,
  exportVisual,
  type ExportFormat,
  type FrameRef,
} from '@/lib/export/visual-exporter';
import { findOwnerFrame } from '@/lib/components/nodes/helpers';
import type { FluxoNode } from '@/lib/types';

type Scope = 'frames' | 'page' | 'viewport';
type Scale = 1 | 2 | 3;

interface ExportVisualDialogProps {
  projectName?: string;
  onClose: () => void;
}

/**
 * Modal de export visual do canvas — captura o React Flow como imagem
 * e exporta em PNG/PDF/HTML.
 *
 *  - `scope=page`: ajusta a vista pra englobar TODOS os nodes (fitView)
 *                  antes de capturar, restaura viewport ao final
 *  - `scope=viewport`: captura como está agora (zoom/pan atuais)
 */
export default function ExportVisualDialog({
  projectName = 'Fluxo',
  onClose,
}: ExportVisualDialogProps) {
  const [scope, setScope] = useState<Scope>('frames');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [scale, setScale] = useState<Scale>(2);
  const [busy, startBusy] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const { fitView, getViewport, setViewport, getNodes } = useReactFlow();

  function handleExport() {
    setErr(null);
    startBusy(async () => {
      try {
        const rfRoot = document.querySelector(
          '.react-flow'
        ) as HTMLElement | null;
        if (!rfRoot) throw new Error('Canvas do React Flow não encontrado.');

        const safeName =
          projectName
            .replace(/[^a-zA-Z0-9-_\s]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .toLowerCase() || 'fluxo';
        const ext = format === 'pdf' ? 'pdf' : format === 'html' ? 'html' : 'png';

        if (scope === 'frames') {
          // Coleta frames + mapeia conteúdo (nodes que pertencem a cada frame)
          const allNodes = getNodes() as unknown as FluxoNode[];
          const frameNodes = allNodes.filter((n) => n.type === 'frame');
          if (frameNodes.length === 0) {
            throw new Error('Nenhum frame na página atual.');
          }
          const frames: FrameRef[] = frameNodes.map((n) => ({
            id: n.id,
            title:
              (n.data?.title as string | undefined) ??
              (n.data?.frameName as string | undefined) ??
              (n.data?.prefix as string | undefined) ??
              'Frame',
            position: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
            width: (n.data?.width as number | undefined) ?? 540,
            height: (n.data?.height as number | undefined) ?? 400,
          }));

          // Pra cada frame, mapeia os IDs dos nodes que o findOwnerFrame
          // aponta pra ele. Bbox do crop vai abraçar todos esses elementos.
          const contentByFrame = new Map<string, string[]>();
          for (const f of frameNodes) contentByFrame.set(f.id, []);
          for (const n of allNodes) {
            if (n.type === 'frame') continue;
            if (n.parentId) continue; // children (tracking/excecao) seguem o parent
            const owner = findOwnerFrame(n, allNodes);
            if (owner) contentByFrame.get(owner.id)?.push(n.id);
          }

          const savedVp = getViewport();

          // Container do React Flow pra dimensões (cálculo do fit manual)
          const containerEl = rfRoot;
          const containerW = containerEl.clientWidth;
          const containerH = containerEl.clientHeight;

          // Fit MANUAL via setViewport — mais confiável que fitView({nodes})
          // que às vezes não foca no frame especificado. Calcula zoom/pan
          // pra centralizar o frame com 10% de padding.
          const fitFrameManual = (frameId: string) => {
            const f = frames.find((fr) => fr.id === frameId);
            if (!f) return;
            const padding = 0.1;
            const zoom = Math.min(
              containerW / (f.width * (1 + padding * 2)),
              containerH / (f.height * (1 + padding * 2)),
              1.5 // teto pra não estourar em frames pequenos
            );
            const centerX = f.position.x + f.width / 2;
            const centerY = f.position.y + f.height / 2;
            const vpX = containerW / 2 - centerX * zoom;
            const vpY = containerH / 2 - centerY * zoom;
            setViewport({ x: vpX, y: vpY, zoom });
          };

          await exportFrames(
            {
              rfRoot,
              frames,
              fitFrame: fitFrameManual,
              contentByFrame,
              restoreViewport: () => setViewport(savedVp),
            },
            format,
            {
              filename: `${safeName}.${ext}`,
              title: projectName,
              scale,
            }
          );
          onClose();
          return;
        }

        // Modos "página inteira" e "visível"
        let restoreViewport: (() => void) | null = null;
        if (scope === 'page') {
          const savedVp = getViewport();
          fitView({ padding: 0.1, duration: 0 });
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          restoreViewport = () => setViewport(savedVp);
        }

        await exportVisual(rfRoot, format, {
          filename: `${safeName}.${ext}`,
          title: projectName,
          scale,
        });

        restoreViewport?.();
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <header className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">
            📷 Exportar imagem
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none disabled:opacity-50"
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="p-5 space-y-5">
          {/* Escopo */}
          <Section title="Escopo">
            <RadioRow
              checked={scope === 'frames'}
              onChange={() => setScope('frames')}
              label="Frame por frame (recomendado)"
              description="Cada frame vira UMA captura separada. No PDF, uma página por frame. No HTML, uma seção por frame. No PNG, um arquivo por frame."
            />
            <RadioRow
              checked={scope === 'page'}
              onChange={() => setScope('page')}
              label="Página inteira (visão geral)"
              description="UMA captura com TODOS os frames juntos (ajusta a vista automaticamente)."
            />
            <RadioRow
              checked={scope === 'viewport'}
              onChange={() => setScope('viewport')}
              label="Visível na tela"
              description="Captura apenas o que está dentro da viewport atual (zoom e pan respeitados)."
            />
          </Section>

          {/* Formato */}
          <Section title="Formato">
            <div className="flex gap-2">
              {(['png', 'pdf', 'html'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={
                    'px-3 py-1.5 text-xs font-medium rounded border ' +
                    (format === f
                      ? 'bg-blip-purple text-white border-blip-purple'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
                  }
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {format === 'png' && 'Imagem PNG do canvas.'}
              {format === 'pdf' && 'PDF com a imagem inserida (uma página dimensionada pra encaixar).'}
              {format === 'html' && 'HTML estático auto-contido (PNG embedded), compartilhável por email/URL.'}
            </p>
          </Section>

          {/* Escala */}
          <Section title="Qualidade">
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScale(s)}
                  className={
                    'px-3 py-1.5 text-xs font-medium rounded border ' +
                    (scale === s
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
                  }
                >
                  {s}x
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {scale === 1 && 'Padrão. Rápido, arquivo menor, pode ficar borrado em telas HiDPI.'}
              {scale === 2 && 'Recomendado. Boa nitidez, arquivo médio.'}
              {scale === 3 && 'Alta resolução. Arquivo grande, captura mais lenta.'}
            </p>
          </Section>

          {err && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {err}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="px-4 py-1.5 text-xs font-medium text-white bg-blip-purple hover:opacity-90 rounded disabled:opacity-50"
          >
            {busy ? 'Exportando…' : 'Exportar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function RadioRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-gray-50">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-blip-purple"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-800">{label}</div>
        <div className="text-[11px] text-gray-500">{description}</div>
      </div>
    </label>
  );
}
