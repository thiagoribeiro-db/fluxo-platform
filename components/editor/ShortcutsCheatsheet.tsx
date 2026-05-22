'use client';

/**
 * Cheatsheet de atalhos — modal que lista TODOS os shortcuts do editor.
 *
 * Aberto via `?` (key down) ou via comando "Atalhos" no Cmd+K.
 * Agrupado por categoria: Comandos, Canvas, Edição, Painéis.
 *
 * Padrão: Linear/Notion/Slack — sempre acessível, fácil de descobrir.
 */
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ShortcutsCheatsheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}

// Macro pra renderizar Cmd/Ctrl dependendo da plataforma
const MOD = typeof window !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Comandos',
    items: [
      { keys: [MOD, 'K'], description: 'Abrir Command Palette' },
      { keys: ['?'], description: 'Mostrar este cheatsheet' },
    ],
  },
  {
    title: 'Edição',
    items: [
      { keys: [MOD, 'Z'], description: 'Desfazer última ação' },
      { keys: [MOD, 'C'], description: 'Copiar texto principal do(s) nó(s) selecionado(s)' },
      { keys: [MOD, 'F'], description: 'Buscar e substituir' },
      { keys: [MOD, 'H'], description: 'Buscar e substituir (alternativo)' },
      { keys: ['Del'], description: 'Apagar nó(s) selecionado(s)' },
      { keys: ['Esc'], description: 'Limpar seleção / fechar dialog' },
    ],
  },
  {
    title: 'Canvas',
    items: [
      { keys: ['Shift', '+ click'], description: 'Selecionar múltiplos nós' },
      { keys: ['Drag'], description: 'Mover nó / pan no canvas' },
      { keys: ['Scroll'], description: 'Zoom in/out' },
      { keys: ['Duplo clique', 'paleta'], description: 'Cria nó abaixo do selecionado/último' },
    ],
  },
  {
    title: 'Painéis (via Cmd+K)',
    items: [
      { keys: ['Testar fluxo'], description: 'Simula uma conversa (Playback)' },
      { keys: ['Problemas'], description: 'Lista validações do linter' },
      { keys: ['Ver histórico'], description: 'Snapshots da página (restaurar versões)' },
      { keys: ['Comentários'], description: 'Painel de comentários' },
    ],
  },
];

export default function ShortcutsCheatsheet({
  open,
  onOpenChange,
}: ShortcutsCheatsheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard size={18} className="text-blip-purple" /> Atalhos do teclado
          </DialogTitle>
          <DialogDescription className="mt-1">
            Aperte <Kbd>?</Kbd> a qualquer momento pra abrir este cheatsheet.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 max-h-[60vh] overflow-y-auto">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-gray-700 dark:text-gray-300 truncate">
                      {s.description}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, idx) => (
                        <Kbd key={idx}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[10px] font-mono font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
      {children}
    </kbd>
  );
}
