'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ResizableSidebarProps {
  /** Largura padrão em px (usada se não houver valor persistido). */
  defaultWidth?: number;
  /** Largura mínima permitida. */
  minWidth?: number;
  /** Largura máxima permitida. */
  maxWidth?: number;
  /** Chave do localStorage pra persistir entre sessões. */
  storageKey?: string;
  /** Lado do handle de redimensionamento: 'right' (default) ou 'left'. */
  side?: 'right' | 'left';
  className?: string;
  children: React.ReactNode;
}

/**
 * Container redimensionável horizontalmente via drag em uma borda.
 *
 * Largura padrão: 256px. Persiste a última largura escolhida em localStorage.
 */
export default function ResizableSidebar({
  defaultWidth = 256,
  minWidth = 180,
  maxWidth = 480,
  storageKey,
  side = 'right',
  className = '',
  children,
}: ResizableSidebarProps) {
  const [width, setWidth] = useState<number>(defaultWidth);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(defaultWidth);

  // Re-sincroniza `width` sempre que `defaultWidth` mudar externamente
  // (caso típico: pai alterna colapsado ↔ expandido e passa width novo).
  // Sem isso, o state interno `width` ficava preso no valor inicial e a
  // sidebar não acompanhava o toggle.
  useEffect(() => {
    setWidth(defaultWidth);
  }, [defaultWidth]);

  // Carrega largura persistida ao montar (só client-side).
  // Roda DEPOIS do effect acima, então sobrescreve com o valor salvo
  // quando há storageKey (modo expandido).
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= minWidth && n <= maxWidth) {
        setWidth(n);
      }
    }
  }, [storageKey, minWidth, maxWidth]);

  const persist = useCallback(
    (w: number) => {
      if (storageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, String(w));
      }
    },
    [storageKey]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width]
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const next =
        side === 'right'
          ? startWidthRef.current + delta
          : startWidthRef.current - delta;
      const clamped = Math.max(minWidth, Math.min(maxWidth, next));
      setWidth(clamped);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persist(width);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [minWidth, maxWidth, side, persist, width]);

  return (
    <div
      className={`relative flex flex-col h-full shrink-0 ${className}`}
      style={{ width }}
    >
      {children}

      {/* Handle de redimensionamento */}
      <div
        onMouseDown={onMouseDown}
        onDoubleClick={() => {
          // Duplo clique reseta pro padrão
          setWidth(defaultWidth);
          persist(defaultWidth);
        }}
        className={`absolute top-0 ${
          side === 'right' ? 'right-0' : 'left-0'
        } h-full w-1 cursor-col-resize hover:bg-blip-purple/30 active:bg-blip-purple/50 z-10 transition-colors`}
        title="Arraste pra redimensionar · Duplo clique reseta"
      />
    </div>
  );
}
