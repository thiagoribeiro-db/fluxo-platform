'use client';

/**
 * Hook de presence + cursor broadcast via Supabase Realtime.
 *
 * Cada projeto tem um canal `project:<projectId>`. Conectados ao canal:
 *  - PRESENCE: cada peer sincroniza { userId, name, avatar, color }
 *  - BROADCAST: cada peer envia cursor moves (throttled a ~30fps)
 *
 * Retorna:
 *  - `peers`: lista de outros users online (excluindo o próprio)
 *  - `cursors`: map peerId → {x, y} (em coords do canvas)
 *  - `sendCursor(x, y)`: chama pra broadcast posição
 *
 * Defensive: se Supabase não tá configurado ou user não autenticado,
 * vira no-op (peers vazio, sendCursor noop).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export interface PresencePeer {
  userId: string;
  name: string;
  email?: string;
  color: string;
}

export interface PresenceCursor {
  peerId: string;
  x: number;
  y: number;
  /** Timestamp do último update — pra fade-out de cursores parados. */
  ts: number;
}

interface UseRealtimePresenceOpts {
  projectId: string | undefined;
  /** Dados do user logado (passados pelo caller via Supabase auth). */
  user: { id: string; email?: string; name?: string } | null;
  enabled?: boolean;
}

interface UseRealtimePresenceResult {
  peers: PresencePeer[];
  cursors: PresenceCursor[];
  sendCursor: (x: number, y: number) => void;
}

const CURSOR_COLORS = [
  '#7857ff', // blip purple
  '#ff6e1d', // blip orange
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
  '#a855f7', // purple
];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

const CURSOR_THROTTLE_MS = 33; // ~30fps

export function useRealtimePresence({
  projectId,
  user,
  enabled = true,
}: UseRealtimePresenceOpts): UseRealtimePresenceResult {
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [cursors, setCursors] = useState<PresenceCursor[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastCursorTsRef = useRef(0);

  // Setup channel
  useEffect(() => {
    if (!enabled || !projectId || !user) return;
    const supabase = createClient();
    const channel = supabase.channel(`project:${projectId}`, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    const selfPeer: PresencePeer = {
      userId: user.id,
      name: user.name ?? user.email?.split('@')[0] ?? 'Visitante',
      email: user.email,
      color: colorForUser(user.id),
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePeer>();
        const allPeers: PresencePeer[] = [];
        for (const key in state) {
          const entries = state[key];
          for (const entry of entries) {
            if (entry.userId !== user.id) {
              allPeers.push(entry);
            }
          }
        }
        setPeers(allPeers);
      })
      .on('broadcast', { event: 'cursor' }, (payload) => {
        const data = payload.payload as { peerId: string; x: number; y: number };
        if (data.peerId === user.id) return; // ignora próprio cursor
        setCursors((prev) => {
          const next = prev.filter((c) => c.peerId !== data.peerId);
          next.push({ peerId: data.peerId, x: data.x, y: data.y, ts: Date.now() });
          return next;
        });
      })
      .on('broadcast', { event: 'cursor-leave' }, (payload) => {
        const data = payload.payload as { peerId: string };
        setCursors((prev) => prev.filter((c) => c.peerId !== data.peerId));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(selfPeer);
        }
      });

    return () => {
      // Notifica peers que estamos saindo
      void channel.send({
        type: 'broadcast',
        event: 'cursor-leave',
        payload: { peerId: user.id },
      });
      supabase.removeChannel(channel);
      channelRef.current = null;
      setPeers([]);
      setCursors([]);
    };
  }, [projectId, user, enabled]);

  // Cleanup cursores parados (>5s sem update) periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => prev.filter((c) => now - c.ts < 5000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sendCursor = useCallback(
    (x: number, y: number) => {
      if (!user || !channelRef.current) return;
      const now = Date.now();
      if (now - lastCursorTsRef.current < CURSOR_THROTTLE_MS) return;
      lastCursorTsRef.current = now;
      void channelRef.current.send({
        type: 'broadcast',
        event: 'cursor',
        payload: { peerId: user.id, x, y },
      });
    },
    [user]
  );

  return { peers, cursors, sendCursor };
}
