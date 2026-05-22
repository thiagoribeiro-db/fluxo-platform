'use client';

/**
 * Welcome tour — onboarding interativo no primeiro acesso ao editor.
 *
 * Usa `driver.js` (lib leve, ~12KB, sem deps). Anchora steps em elementos
 * via `data-tour="<id>"` attributes — adicione esses attrs nos componentes
 * que você quer destacar no tour.
 *
 * Persiste em localStorage `fluxo-tour-v1-done` — só mostra uma vez.
 * Pra rever depois, comando "Tour" no Cmd+K (registry).
 */
import { useCallback, useEffect } from 'react';
import 'driver.js/dist/driver.css';
import { driver } from 'driver.js';

interface WelcomeTourProps {
  /** Se true, força o tour mesmo se já foi visto (ex: comando "Rever tour"). */
  force?: boolean;
  /** Skip se editor não tem nodes ainda (tour assume canvas com conteúdo). */
  hasContent: boolean;
}

const STORAGE_KEY = 'fluxo-tour-v1-done';

function buildTour() {
  return driver({
    showProgress: true,
    nextBtnText: 'Próximo',
    prevBtnText: 'Anterior',
    doneBtnText: 'Pronto!',
    progressText: '{{current}} / {{total}}',
    overlayColor: 'rgba(0, 0, 0, 0.55)',
    onDestroyed: () => {
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignora */
      }
    },
    steps: [
      {
        popover: {
          title: '👋 Bem-vindo ao Fluxo Platform',
          description:
            'Editor visual de fluxos conversacionais. Vou te mostrar em 30 segundos onde fica cada coisa.',
        },
      },
      {
        element: '[data-tour="palette"]',
        popover: {
          title: '🧩 Paleta de componentes',
          description:
            'Arraste componentes pro canvas (Frame, Bubble, Menu, etc.) ou clique duas vezes pra adicionar abaixo do último selecionado.',
          side: 'right',
        },
      },
      {
        element: '[data-tour="toolbar"]',
        popover: {
          title: '🎛️ Toolbar do projeto',
          description:
            'Ações principais: Compartilhar, Comentários, Problemas (linter), Testar fluxo (playground), Organizar layout, Exportar pro Blip, Versões.',
          side: 'bottom',
        },
      },
      {
        popover: {
          title: '⌘K Command Palette',
          description:
            'Aperte ⌘K (ou Ctrl+K) a qualquer momento pra abrir o command palette — atalho rápido pra qualquer ação ou navegação.',
        },
      },
      {
        popover: {
          title: '▶ Test Playground',
          description:
            'Quer testar como ficaria a conversa? Clique em "Testar" na toolbar. Simula o fluxo direto no editor, sem precisar exportar.',
        },
      },
      {
        popover: {
          title: '🎯 Tudo certo!',
          description:
            'Aperte <kbd>?</kbd> pra ver todos os atalhos. Boa criação!',
        },
      },
    ],
  });
}

export default function WelcomeTour({ force, hasContent }: WelcomeTourProps) {
  const start = useCallback(() => {
    const d = buildTour();
    d.drive();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasContent) return; // editor vazio, sem âncoras
    const done =
      !force && localStorage.getItem(STORAGE_KEY) === '1';
    if (done) return;
    // Pequeno delay pra UI assentar antes do tour iniciar
    const t = setTimeout(start, 800);
    return () => clearTimeout(t);
  }, [force, hasContent, start]);

  return null;
}

/** Helper pra disparar tour manualmente (ex: comando "Rever tour"). */
export function startTour() {
  const d = buildTour();
  d.drive();
}
