'use client';

/**
 * Command Palette (Cmd+K / Ctrl+K).
 *
 * Padrão Linear/Notion/Figma: overlay com input + lista de comandos
 * filtrada por fuzzy search. Setas pra navegar, Enter pra executar.
 *
 * Usa `cmdk` (lib do Vercel/Linear) — leve, acessível, fuzzy match
 * built-in, navegação por teclado free.
 *
 * Os comandos vêm do registry (`buildCommands(ctx)`) — dinâmicos
 * conforme o estado atual (lista de frames, permissões, etc.).
 */

import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Compass,
  FileDown,
  Hash,
  Image as ImageIcon,
  LayoutGrid,
  MessageSquare,
  Package,
  Play,
  Plus,
  Share2,
  Sparkles,
  Sprout,
  Trash2,
} from 'lucide-react';
import {
  buildCommands,
  commandGroupLabel,
  type CommandContext,
  type CommandGroup,
} from '@/lib/commands/registry';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: CommandContext;
}

const groupIcons: Record<CommandGroup, typeof Plus> = {
  create: Plus,
  navigate: Compass,
  panels: MessageSquare,
  actions: Sparkles,
  export: FileDown,
  general: ArrowLeft,
};

const GROUP_ORDER: CommandGroup[] = [
  'create',
  'navigate',
  'panels',
  'actions',
  'export',
  'general',
];

/**
 * Ícone específico por id de comando — pra rótulos visuais que ajudam
 * o user a "ver" a ação rápido sem ler.
 */
function iconForCommand(id: string, group: CommandGroup): typeof Plus {
  if (id === 'create-frame') return Package;
  if (id === 'create-entry-point') return Play;
  if (id === 'create-bubble-bot' || id === 'create-bubble-user')
    return MessageSquare;
  if (id === 'open-playback') return Play;
  if (id === 'open-problems') return AlertCircle;
  if (id === 'open-comments') return MessageSquare;
  if (id === 'organize-layout') return LayoutGrid;
  if (id === 'reorder-codes') return Hash;
  if (id === 'reset-page') return Trash2;
  if (id === 'load-template') return Sprout;
  if (id === 'export-blip') return Package;
  if (id === 'export-visual') return ImageIcon;
  if (id === 'share') return Share2;
  if (id === 'back-to-dashboard') return ArrowLeft;
  if (group === 'navigate') return Compass;
  if (group === 'create') return Plus;
  return Activity;
}

export default function CommandPalette({
  open,
  onOpenChange,
  context,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const commands = useMemo(() => buildCommands(context), [context]);

  // Reset busca ao abrir/fechar
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  // Agrupa por grupo (mantendo ordem definida)
  const groupedCommands = useMemo(() => {
    const map = new Map<CommandGroup, typeof commands>();
    for (const cmd of commands) {
      if (!map.has(cmd.group)) map.set(cmd.group, []);
      map.get(cmd.group)!.push(cmd);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      items: map.get(g)!,
    }));
  }, [commands]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10002] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[18vh] px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <Command
        label="Comandos"
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl ring-1 ring-gray-200 overflow-hidden flex flex-col"
        // Permite ESC fechar
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onOpenChange(false);
          }
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200">
          <Sparkles size={16} className="text-blip-purple shrink-0" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            autoFocus
            placeholder="O que você quer fazer? (criar, ir até, exportar…)"
            className="flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-gray-500">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto py-1">
          <Command.Empty className="px-4 py-8 text-center text-sm text-gray-500">
            Nenhum comando encontrado.
            <div className="text-xs text-gray-400 mt-1">
              Tente &quot;criar&quot;, &quot;organizar&quot;, &quot;exportar&quot;,
              &quot;testar&quot; ou o nome de um frame.
            </div>
          </Command.Empty>

          {groupedCommands.map(({ group, items }) => (
            <Command.Group
              key={group}
              heading={commandGroupLabel(group)}
              className="px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-gray-400"
            >
              {items.map((cmd) => {
                const Icon = iconForCommand(cmd.id, cmd.group);
                return (
                  <Command.Item
                    key={cmd.id}
                    value={`${cmd.label} ${(cmd.keywords ?? []).join(' ')}`}
                    onSelect={() => {
                      onOpenChange(false);
                      // Pequeno delay pra esperar o close antes de executar
                      // (evita que o modal de confirmação capture o ESC do palette)
                      setTimeout(() => cmd.perform(), 50);
                    }}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md mx-1 text-sm text-gray-700 cursor-pointer aria-selected:bg-blip-purple/10 aria-selected:text-blip-purple-dark"
                  >
                    <Icon
                      size={15}
                      className="shrink-0 text-gray-400 group-aria-selected:text-blip-purple"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{cmd.label}</div>
                      {cmd.description && (
                        <div className="text-[11px] text-gray-400 truncate">
                          {cmd.description}
                        </div>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="text-[10px] font-mono text-gray-400">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>

        <div className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-gray-200">↑↓</kbd>{' '}
              navegar
            </span>
            <span>
              <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-gray-200">↵</kbd>{' '}
              executar
            </span>
          </div>
          <div>
            <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-gray-200">⌘K</kbd>{' '}
            ou <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-gray-200">Ctrl K</kbd>
          </div>
        </div>
      </Command>
    </div>
  );
}
