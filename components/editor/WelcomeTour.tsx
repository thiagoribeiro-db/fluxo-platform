'use client';

/**
 * Welcome tour — onboarding interativo no primeiro acesso ao editor.
 *
 * Usa `driver.js` (lib leve, ~12KB, sem deps). Anchora steps em elementos
 * via `data-tour="<id>"` attributes — adicione esses attrs nos componentes
 * que você quer destacar no tour.
 *
 * Persiste em localStorage `fluxo-tour-v1-done` — só mostra uma vez.
 * Pra rever depois, comando "Rever tour" no Cmd+K.
 *
 * Conteúdo: explica os CONCEITOS além de apenas mostrar onde fica cada
 * coisa — frames com prefixo, IDs por frame, tracking auto, conexões,
 * dual sidebar (paleta + propriedades), modos de canvas (mover/selecionar).
 * Cada step tem entre 1-3 frases curtas — leitura rápida, mas didática.
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
    nextBtnText: 'Próximo →',
    prevBtnText: '← Anterior',
    doneBtnText: '🎉 Pronto!',
    progressText: 'Passo {{current}} de {{total}}',
    overlayColor: 'rgba(0, 0, 0, 0.6)',
    allowClose: true,
    showButtons: ['next', 'previous', 'close'],
    onDestroyed: () => {
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignora */
      }
    },
    steps: [
      // ───────────────────────────── 1. INTRO ──────────────────────────
      {
        popover: {
          title: '👋 Bem-vindo ao Fluxo Platform',
          description: `
            <p style="margin-bottom: 8px">Editor visual de fluxos conversacionais (Blip / Digitalbot).</p>
            <p style="margin-bottom: 8px">Vou te apresentar a interface em <strong>~2 minutos</strong> — onde fica cada coisa, os conceitos principais e os atalhos que vão te economizar tempo.</p>
            <p style="font-size: 12px; color: #666">Você pode fechar a qualquer momento (botão X ou ESC).</p>
          `,
        },
      },

      // ───────────────────────────── 2. SIDEBAR HEADER ─────────────────
      {
        element: '[data-tour="sidebar-header"]',
        popover: {
          title: '🏠 Header do projeto',
          description: `
            <p style="margin-bottom: 8px">Aqui mostra o <strong>nome do projeto</strong> e o status do <strong>autosave</strong> ("Salvo" / "Salvando…").</p>
            <p style="margin-bottom: 8px">Clica pra <strong>voltar pro dashboard</strong>. O ícone à direita troca <strong>tema claro/escuro</strong>.</p>
          `,
          side: 'right',
        },
      },

      // ───────────────────────────── 3. PAGES ─────────────────────────
      {
        element: '[data-tour="pages-sidebar"]',
        popover: {
          title: '📄 Páginas (dev / hmg / prd)',
          description: `
            <p style="margin-bottom: 8px">Cada projeto tem <strong>múltiplas páginas</strong> — pense em ambientes (dev, hmg, prd) ou variações.</p>
            <p style="margin-bottom: 8px">Clica numa pra trocar. <strong>+ Nova</strong> cria, <strong>⎘</strong> duplica, <strong>✕</strong> apaga.</p>
            <p style="font-size: 12px; color: #666">Cada página tem o próprio histórico de versões.</p>
          `,
          side: 'right',
        },
      },

      // ───────────────────────────── 4. PALETA ────────────────────────
      {
        element: '[data-tour="palette"]',
        popover: {
          title: '🧩 Paleta de componentes',
          description: `
            <p style="margin-bottom: 8px">Os blocos do fluxo: <strong>Frame</strong> (container), <strong>Bubble</strong> (mensagem), <strong>Menu</strong>, <strong>Botões</strong>, <strong>Mídia</strong>, <strong>Direcionamento</strong>, e mais.</p>
            <p style="margin-bottom: 8px">Duas formas de adicionar:<br>
              • <strong>Arrastar</strong> pro canvas (drop onde quiser)<br>
              • <strong>Clicar duas vezes</strong> — adiciona abaixo do último selecionado
            </p>
          `,
          side: 'right',
        },
      },

      // ───────────────────────────── 5. CONCEITO FRAMES ───────────────
      {
        popover: {
          title: '📦 Conceito-chave: Frames + Prefixos',
          description: `
            <p style="margin-bottom: 8px">Cada <strong>Frame</strong> é um container com um <strong>prefixo</strong> (ex: S, O, T).</p>
            <p style="margin-bottom: 8px">Blocos DENTRO do frame ganham IDs automáticos: <code>S001, S002, S003…</code></p>
            <p style="margin-bottom: 8px">Configura o prefixo no <strong>painel de Propriedades</strong> (lado direito) quando seleciona um frame.</p>
            <p style="font-size: 12px; color: #666">Renomear um bloco não quebra conexões — referências usam ID estável interno.</p>
          `,
        },
      },

      // ───────────────────────────── 6. TOOLBAR ───────────────────────
      {
        element: '[data-tour="toolbar"]',
        popover: {
          title: '🎛️ Toolbar superior',
          description: `
            <p style="margin-bottom: 8px"><strong>Compartilhar</strong> (CTA roxo) — link público read-only / comment / edit.</p>
            <p style="margin-bottom: 8px"><strong>✨ IA</strong> — chat contextual sobre o seu fluxo, sugere blocos.</p>
            <p style="margin-bottom: 8px">Dropdowns: <strong>Editar</strong> (buscar, organizar, resetar), <strong>Visualizar</strong> (problemas, testar, versões, comentários), <strong>Exportar</strong> (Blip .zip, imagem, template).</p>
          `,
          side: 'bottom',
        },
      },

      // ───────────────────────────── 7. PROPERTIES PANEL ──────────────
      {
        element: '[data-tour="properties-panel"]',
        popover: {
          title: '⚙️ Painel de Propriedades',
          description: `
            <p style="margin-bottom: 8px">Quando você <strong>seleciona um bloco</strong>, aqui aparecem os campos editáveis (texto, label, código, etc.).</p>
            <p style="margin-bottom: 8px">Sem seleção, lista os <strong>frames do projeto</strong> — clica pra navegar até cada um.</p>
            <p style="margin-bottom: 8px">Abaixo do bloco: seção <strong>Conexões</strong> — adiciona/troca/remove pais e filhos sem arrastar handles.</p>
          `,
          side: 'left',
        },
      },

      // ───────────────────────────── 8. BOTTOM TOOLBAR ────────────────
      {
        element: '[data-tour="bottom-toolbar"]',
        popover: {
          title: '🖐️ Modos de canvas (H / V)',
          description: `
            <p style="margin-bottom: 8px"><strong>✋ Mover</strong> (atalho <kbd>H</kbd>) — drag move o canvas (panorâmica).</p>
            <p style="margin-bottom: 8px"><strong>⬚ Selecionar</strong> (atalho <kbd>V</kbd>) — drag desenha retângulo de seleção múltipla.</p>
            <p style="font-size: 12px; color: #666">Shift+click também adiciona à seleção.</p>
          `,
          side: 'top',
        },
      },

      // ───────────────────────────── 9. AUTO-TRACKING ────────────────
      {
        popover: {
          title: '🎯 Tracking automático',
          description: `
            <p style="margin-bottom: 8px">Quando você cria um <strong>Bubble Bot</strong>, o editor adiciona automaticamente um <strong>tracking</strong> "_exibicao" como filho.</p>
            <p style="margin-bottom: 8px">Pra <strong>Menu</strong>: cria 3 trackings (exibicao, selecao, inesperado).</p>
            <p style="margin-bottom: 8px">Bubble User: cria <strong>exceção</strong> + tracking "_input" no bloco anterior.</p>
            <p style="font-size: 12px; color: #666">Desliga o toggle <strong>Tracking</strong> na toolbar se não quiser esse comportamento.</p>
          `,
        },
      },

      // ───────────────────────────── 10. CMD+K ────────────────────────
      {
        popover: {
          title: '⌘ Command Palette',
          description: `
            <p style="margin-bottom: 8px">Aperte <kbd>⌘K</kbd> (ou <kbd>Ctrl+K</kbd>) pra abrir o <strong>command palette</strong>.</p>
            <p style="margin-bottom: 8px">Acesso rápido a <strong>tudo</strong>: criar blocos, ir até frames, exportar, abrir painéis, IA, organizar layout.</p>
            <p style="font-size: 12px; color: #666">Digita o que quer fazer — funciona por fuzzy match (ex: "exp" acha "Exportar Blip").</p>
          `,
        },
      },

      // ───────────────────────────── 11. SHORTCUTS ────────────────────
      {
        popover: {
          title: '⌨️ Atalhos essenciais',
          description: `
            <p style="margin-bottom: 8px">• <kbd>?</kbd> — abre o <strong>cheatsheet completo</strong></p>
            <p style="margin-bottom: 8px">• <kbd>⌘F</kbd> ou <kbd>⌘H</kbd> — <strong>buscar e substituir</strong></p>
            <p style="margin-bottom: 8px">• <kbd>⌘Z</kbd> — desfazer · <kbd>⌘C</kbd> — copiar texto do bloco · <kbd>⌘D</kbd> — duplicar · <kbd>Del</kbd> — apagar</p>
            <p style="margin-bottom: 8px">• <kbd>Esc</kbd> — limpa seleção / fecha dialogs</p>
          `,
        },
      },

      // ───────────────────────────── 12. FECHAMENTO ───────────────────
      {
        popover: {
          title: '🎉 Tudo pronto!',
          description: `
            <p style="margin-bottom: 8px">Pra rever esse tour, abre <kbd>⌘K</kbd> e digita "tour".</p>
            <p style="margin-bottom: 8px">Pra ajuda contextual: <strong>✨ IA</strong> na toolbar ou aperta <kbd>?</kbd> pro cheatsheet.</p>
            <p style="margin-bottom: 8px"><strong>Dicas finais:</strong></p>
            <ul style="margin-left: 16px; font-size: 13px">
              <li>O autosave salva a cada poucas mudanças — não precisa Ctrl+S.</li>
              <li>Use "Organizar layout" pra alinhar tudo num clique.</li>
              <li>Antes de aplicar Template/IA, um snapshot é criado automaticamente — dá pra restaurar em Versões.</li>
            </ul>
            <p style="margin-top: 8px; color: #6F2DBD"><strong>Boa criação! 🚀</strong></p>
          `,
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
    const done = !force && localStorage.getItem(STORAGE_KEY) === '1';
    if (done) return;
    // Pequeno delay pra UI assentar antes do tour iniciar (autosave, layout,
    // dropdowns, etc. precisam terminar mount pra âncoras existirem no DOM).
    const t = setTimeout(start, 1000);
    return () => clearTimeout(t);
  }, [force, hasContent, start]);

  return null;
}

/** Helper pra disparar tour manualmente (ex: comando "Rever tour"). */
export function startTour() {
  // Limpa o flag pra garantir que tour rode mesmo se já foi visto antes
  // (caso o user reabra via Cmd+K → "Rever tour"). UseEffect com `force`
  // também funciona, mas isso garante que persistência seja resetada.
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignora */
  }
  const d = buildTour();
  d.drive();
}
