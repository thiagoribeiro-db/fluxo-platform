'use client';

/**
 * Stack de avatares pra mostrar quem está online no projeto.
 *
 * Renderiza os primeiros 4 avatares e um "+N" se houver mais.
 * Tooltip nativo (title) mostra o nome.
 */
import type { PresencePeer } from '@/lib/realtime/use-realtime-presence';

interface PresenceAvatarsProps {
  peers: PresencePeer[];
  /** Tamanho do avatar em px. Default 28. */
  size?: number;
}

export default function PresenceAvatars({ peers, size = 28 }: PresenceAvatarsProps) {
  if (peers.length === 0) return null;
  const visible = peers.slice(0, 4);
  const extra = peers.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((p) => (
        <div
          key={p.userId}
          title={`${p.name}${p.email ? ` · ${p.email}` : ''}`}
          className="rounded-full ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
          style={{
            width: size,
            height: size,
            backgroundColor: p.color,
            zIndex: 10,
          }}
        >
          {initials(p.name)}
        </div>
      ))}
      {extra > 0 && (
        <div
          title={`${extra} usuário(s) a mais online`}
          className="rounded-full ring-2 ring-white dark:ring-gray-900 bg-gray-400 dark:bg-gray-600 text-white text-[10px] font-bold flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
