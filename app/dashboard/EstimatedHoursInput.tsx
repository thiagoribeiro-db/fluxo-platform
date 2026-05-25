'use client';

/**
 * Input compacto pra editar `estimated_hours` direto no card do dashboard.
 *
 * Estado idle mostra o valor (ou "—") + ícone de lápis. Click vira input
 * numérico. Blur ou Enter salva via server action. Esc cancela.
 */

import { useState, useTransition } from 'react';
import { updateProject } from '@/lib/actions/projects';
import { toast } from '@/lib/utils/errors';

interface EstimatedHoursInputProps {
  projectId: string;
  initialHours: number | null;
}

export default function EstimatedHoursInput({
  projectId,
  initialHours,
}: EstimatedHoursInputProps) {
  const [hours, setHours] = useState<number | null>(initialHours);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(initialHours?.toString() ?? '');
  const [pending, startTransition] = useTransition();

  function commit() {
    setEditing(false);
    const parsed = draft.trim() === '' ? null : Number(draft);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      toast({ level: 'warn', message: 'Horas inválidas. Use número positivo ou deixe vazio.' });
      setDraft(hours?.toString() ?? '');
      return;
    }
    if (parsed === hours) return; // sem mudança
    const previous = hours;
    setHours(parsed);
    startTransition(async () => {
      try {
        await updateProject(projectId, { estimated_hours: parsed });
        toast({
          level: 'success',
          message: parsed === null ? 'Estimativa removida' : `Estimativa: ${parsed}h`,
        });
      } catch (err) {
        setHours(previous);
        setDraft(previous?.toString() ?? '');
        toast({
          level: 'error',
          message: err instanceof Error ? err.message : 'Erro ao salvar horas',
        });
      }
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        step={0.5}
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setEditing(false);
            setDraft(hours?.toString() ?? '');
          }
        }}
        placeholder="horas"
        className="w-16 rounded border border-blip-purple px-1.5 py-0.5 text-[11px] outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setEditing(true);
        setDraft(hours?.toString() ?? '');
      }}
      disabled={pending}
      title={hours === null ? 'Clique pra estimar' : `${hours} horas estimadas`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 disabled:opacity-50"
    >
      <span>⏱</span>
      <span>{pending ? '…' : hours === null ? '—' : `${hours}h`}</span>
    </button>
  );
}
