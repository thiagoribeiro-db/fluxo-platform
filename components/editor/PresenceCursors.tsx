'use client';

/**
 * Renderiza cursores dos peers conectados em coords do canvas React Flow.
 *
 * Posicionamento é absoluto dentro do `.react-flow` (não considera viewport
 * pan/zoom diretamente — os cursores são em SCREEN coords, capturadas com
 * `e.clientX/Y - rect.left/top` pelo emissor).
 *
 * Pra cada peer, um cursor SVG + label com nome.
 */
import { useEffect, useState } from 'react';
import type { PresenceCursor, PresencePeer } from '@/lib/realtime/use-realtime-presence';

interface PresenceCursorsProps {
  cursors: PresenceCursor[];
  peers: PresencePeer[];
}

export default function PresenceCursors({ cursors, peers }: PresenceCursorsProps) {
  // Recalcula coords no resize do container
  const [, force] = useState(0);
  useEffect(() => {
    const onResize = () => force((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (cursors.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {cursors.map((c) => {
        const peer = peers.find((p) => p.userId === c.peerId);
        const color = peer?.color ?? '#7857ff';
        const name = peer?.name ?? 'Visitante';
        return (
          <div
            key={c.peerId}
            className="absolute transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${c.x}px, ${c.y}px)`,
              left: 0,
              top: 0,
            }}
          >
            {/* SVG cursor pointer */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              style={{ display: 'block' }}
            >
              <path
                d="M2 2L8 14L9.5 9.5L14 8L2 2Z"
                fill={color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Label com nome */}
            <span
              className="absolute top-4 left-4 px-1.5 py-0.5 text-[10px] font-medium text-white rounded shadow-sm whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
