'use client';

/**
 * Cheatsheet de atalhos — modal que lista TODOS os shortcuts do editor.
 *
 * Aberto via `?` (key down) ou via comando "Atalhos" no Cmd+K.
 * Agrupado por categoria: Comandos, Canvas, Edição, Painéis.
 *
 * Padrão: Linear/Notion/Slack — sempre acessível, fácil de descobrir.
 *
 * Layout: tela grande (max-w-4xl) com grid 2 colunas no desktop pra evitar
 * cortes em descrições longas. Cards por categoria com header colorido +
 * lista de items com Kbd à direita.
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
  emoji: string;
  items: Shortcut[];
}

// Macro pra renderizar Cmd/Ctrl dependendo da plataforma
const MOD = typeof window !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Comandos',
    emoji: '⚡',
    items: [
      { keys: [MOD, 'K'], description: 'Abrir Command Palette' },
      { keys: ['?'], description: 'Mostrar este cheatsheet' },
    ],
  },
  {
    title: 'Edição',
    emoji: '✏️',
    items: [
      { keys: [MOD, 'Z'], description: 'Desfazer última ação' },
      { keys: [MOD, 'C'], description: 'Copiar texto do(s) nó(s) selecionado(s)' },
      { keys: [MOD, 'D'], description: 'Duplicar nó selecionado' },
      { keys: [MOD, 'F'], description: 'Buscar e substituir' },
      { keys: [MOD, 'H'], description: 'Buscar e substituir (alternativo)' },
      { keys: ['Del'], description: 'Apagar nó(s) selecionado(s)' },
      { keys: ['Esc'], description: 'Limpar seleção / fechar dialog' },
    ],
  },
  {
    title: 'Canvas',
    emoji: '🎨',
    items: [
      { keys: ['H'], description: 'Modo Mover (pan canvas)' },
      { keys: ['V'], description: 'Modo Selecionar (rubber band)' },
      { keys: ['Shift', '+ click'], description: 'Selecionar múltiplos nós' },
      { keys: ['Drag'], description: 'Mover nó / pan no canvas' },
      { keys: ['Scroll'], description: 'Zoom in/out' },
      { keys: ['Duplo clique', 'paleta'], description: 'Cria nó abaixo do selecionado/último' },
    ],
  },
  {
    title: 'Painéis (via Cmd+K)',
    emoji: '🪟',
    items: [
      { keys: ['Testar fluxo'], description: 'Simula uma conversa (Playback)' },
      { keys: ['Problemas'], description: 'Lista validações do linter' },
      { keys: ['Ver histórico'], description: 'Snapshots da página (restaurar versões)' },
      { keys: ['Comentários'], description: 'Painel de comentários' },
      { keys: ['Chat IA'], description: 'Pergunta sobre o fluxo, sugere blocos' },
    ],
  },
];

export default function ShortcutsCheatsheet({
  open,
  onOpenChange,
}: ShortcutsCheatsheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] dark:bg-gray-900 max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 dark:text-white">
            <Keyboard size={20} className="text-blip-purple" /> Atalhos do teclado
          </DialogTitle>
          <DialogDescription className="mt-1 dark:text-gray-400">
            Aperte <Kbd>?</Kbd> a qualquer momento pra abrir este cheatsheet.{' '}
            Pra ver TODAS as ações disponíveis, abra o Command Palette com{' '}
            <Kbd>{MOD}</Kbd>+<Kbd>K</Kbd>.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 overflow-y-auto flex-1">
          {GROUPS.map((g) => (
            <section key={g.title} className="break-inside-avoid">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 pb-1.5 border-b border-gray-100 dark:border-gray-800">
                <span aria-hidden>{g.emoji}</span> {g.title}
              </h3>
              <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {g.items.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-4 py-2 text-sm"
                  >
                    <span className="text-gray-700 dark:text-gray-300 leading-snug flex-1">
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

        <div className="shrink-0 mt-2 px-5 pb-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
          💡 Procurando uma ação específica? Abra{' '}
          <Kbd>{MOD}</Kbd>+<Kbd>K</Kbd> e digite o que quer fazer — busca por
          comando, nome de frame, exportação, etc.
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[10px] font-mono font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
      {children}
    </kbd>
  );
}
