'use client';

/**
 * FlowSubEditor — sub-editor modal pra construir um WhatsApp Flow.
 *
 * Estrutura: split em 3 colunas:
 *  - Esquerda: lista de screens + paleta de componentes
 *  - Centro: mockup WhatsApp da screen ativa (clica num component pra editar)
 *  - Direita: inspector do component selecionado (ou props do Flow se nada)
 *
 * Estado vive em useState local; mudanças propagam pro node via onUpdate.
 * Cada persist atualiza flowUpdatedAt — dispara badges visuais no canvas.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Star,
  Flag,
  Code2,
  AlertTriangle,
  CheckCircle2,
  Download,
  Play,
  Pencil,
  Save,
  Loader2,
} from 'lucide-react';
import type {
  FluxoNode,
  WhatsAppFlowCategory,
  WhatsAppFlowComponent,
  WhatsAppFlowComponentType,
  WhatsAppFlowScreen,
} from '@/lib/types';
import {
  FLOW_CATEGORIES,
  FLOW_LIMITS,
  createBlankScreen,
} from '@/lib/whatsapp-flows/constants';
import { createComponent } from '@/lib/whatsapp-flows/components';
import { validateFlow, type FlowValidationProblem } from '@/lib/whatsapp-flows/validate';
import { buildFlowJson } from '@/lib/whatsapp-flows/export';
import { toast } from '@/lib/utils/errors';
import { markSeen } from '@/lib/utils/seen-tracker';
import { formatTimeAgo } from '@/lib/utils/time-ago';
import FlowComponentPreview from './flow-components/FlowComponentPreview';
import FlowComponentInspector from './flow-components/FlowComponentInspector';
import FlowComponentPalette from './flow-components/FlowComponentPalette';
import FlowPreviewRuntime from './flow-components/FlowPreviewRuntime';

export interface FlowSubEditorProps {
  /** Node a ser editado. Se null, modal fica fechado. */
  node: FluxoNode | null;
  onClose: () => void;
  onUpdate: (patch: Partial<FluxoNode['data']>) => void;
}

export default function FlowSubEditor({ node, onClose, onUpdate }: FlowSubEditorProps) {
  // Estado local — sincronizado com node.data via useEffect quando o node muda.
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WhatsAppFlowCategory>('OTHER');
  const [triggerLabel, setTriggerLabel] = useState('');
  const [screens, setScreens] = useState<WhatsAppFlowScreen[]>([]);
  const [dataChannelUri, setDataChannelUri] = useState('');
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  /** Component selecionado pra edição no inspector (null = props do Flow). */
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  /** Modal "ver JSON" — preview do export final. */
  const [jsonPreviewOpen, setJsonPreviewOpen] = useState(false);
  /** Modo preview interativo: substitui mockup estático pelo runtime simulado. */
  const [previewMode, setPreviewMode] = useState(false);
  /**
   * Status de salvamento — sub-editor já propaga cada mudança via onUpdate
   * (que aciona o autosave do projeto). Esse state só serve pra UI mostrar
   * feedback ao user:
   *  - 'idle'    → tudo salvo
   *  - 'dirty'   → edição recém-feita, autosave debounced ainda rodando
   *  - 'saving'  → forçado pelo botão "Salvar"
   *  - 'saved'   → flash verde após salvar manualmente
   */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
  /** Timestamp da última edição (pra "salvo há X"). */
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  /** Force re-render a cada 30s pra atualizar "salvo há X". */
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  /** Timer pra voltar 'dirty' → 'idle' depois do autosave debounced (~1.5s). */
  const dirtyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Lint do Flow atual — recomputado a cada mudança de screens / endpoint. */
  const validationProblems = useMemo<FlowValidationProblem[]>(
    () => validateFlow({ screens, dataChannelUri }),
    [screens, dataChannelUri]
  );
  const errorCount = validationProblems.filter((p) => p.severity === 'error').length;
  const warnCount = validationProblems.filter((p) => p.severity === 'warning').length;

  // Carrega estado quando abre/troca de node
  useEffect(() => {
    if (!node) return;
    const d = node.data;
    setName((d.flowName as string | undefined) ?? 'Novo Flow');
    setCategory((d.flowCategory as WhatsAppFlowCategory | undefined) ?? 'OTHER');
    setTriggerLabel((d.triggerLabel as string | undefined) ?? 'Abrir');
    setDataChannelUri((d.dataChannelUri as string | undefined) ?? '');
    const ss = (d.screens as WhatsAppFlowScreen[] | undefined) ?? [];
    const initialScreens = ss.length > 0 ? ss : [createBlankScreen({ title: 'Início', isEntry: true })];
    setScreens(initialScreens);
    setSelectedScreenId(initialScreens[0]?.id ?? null);
    setPreviewMode(false); // sempre abre em edit mode
    setSaveStatus('idle');
    setLastSavedAt((d.flowUpdatedAt as string | undefined) ?? null);
    // Ao ABRIR o sub-editor, marca como visto — limpa o dot indicator
    // "atualização não vista" no node do canvas. Usa flowUpdatedAt atual
    // (se houver) ou now() como referência.
    const updatedAt = (d.flowUpdatedAt as string | undefined) ?? new Date().toISOString();
    markSeen('flow', node.id, updatedAt);
    // Cleanup timer dirty quando troca de node
    return () => {
      if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current);
    };
  }, [node]);

  const selectedScreen = useMemo(
    () => screens.find((s) => s.id === selectedScreenId) ?? null,
    [screens, selectedScreenId]
  );

  // Atalho global Ctrl+S / Cmd+S — força salvamento (UI feedback)
  useEffect(() => {
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);
  const selectedComponent = useMemo(
    () =>
      selectedScreen?.components.find((c) => c.id === selectedComponentId) ?? null,
    [selectedScreen, selectedComponentId]
  );

  if (!node) return null;

  // ----- Handlers --------------------------------------------------------

  /**
   * Persiste mudança no node + atualiza timestamp da última edição.
   * Esse timestamp dispara badges visuais no node do canvas:
   *  - "atualizado há X" (formatTimeAgo)
   *  - pulse de 5min (isRecent)
   *  - dot indicator "não visto" (compara contra lastSeen no localStorage)
   *
   * Marca também o saveStatus → 'dirty' → 'idle' após autosave debounced
   * do projeto (1.5s — vale o debounce típico do useAutoSave do FlowEditor).
   */
  function persist(patch: Partial<FluxoNode['data']>) {
    const now = new Date().toISOString();
    onUpdate({ ...patch, flowUpdatedAt: now });
    setSaveStatus('dirty');
    setLastSavedAt(now);
    if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current);
    dirtyTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1800);
  }

  /**
   * "Salvar agora" — força um ciclo de persist + UI feedback. O autosave do
   * projeto já rodaria sozinho mas isso dá confiança visual ao user (estilo
   * Cmd+S do VSCode).
   */
  function saveNow() {
    if (!node) return;
    setSaveStatus('saving');
    const now = new Date().toISOString();
    onUpdate({ flowUpdatedAt: now });
    setLastSavedAt(now);
    // Pequeno delay pra animação ser visível
    setTimeout(() => {
      setSaveStatus('saved');
      toast({ level: 'success', message: 'Flow salvo' });
      setTimeout(() => setSaveStatus('idle'), 1500);
    }, 250);
  }

  /** Fecha o sub-editor mostrando toast de confirmação. */
  function handleClose() {
    if (node) {
      // Marca como visto novamente com timestamp ATUAL — garante que o badge
      // "não visto" não dispare imediatamente após fechar.
      markSeen('flow', node.id, new Date().toISOString());
    }
    toast({
      level: 'success',
      message: `Flow "${name}" salvo`,
      detail: `${screens.length} tela${screens.length === 1 ? '' : 's'}`,
    });
    onClose();
  }

  /** Download do Flow JSON gerado (formato Meta v7.1). */
  function downloadFlowJson() {
    if (!node) return;
    const json = buildFlowJson(node.data);
    const blob = new Blob([JSON.stringify(json, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-${(name || 'flow').toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      level: 'success',
      message: 'Flow JSON baixado',
      detail: `${screens.length} tela${screens.length === 1 ? '' : 's'} · v${node.data.flowJsonVersion ?? '7.1'}`,
    });
  }

  function updateName(value: string) {
    const v = value.slice(0, FLOW_LIMITS.flowName);
    setName(v);
    persist({ flowName: v });
  }

  function updateCategory(value: WhatsAppFlowCategory) {
    setCategory(value);
    persist({ flowCategory: value });
  }

  function updateTrigger(value: string) {
    const v = value.slice(0, FLOW_LIMITS.triggerLabel);
    setTriggerLabel(v);
    persist({ triggerLabel: v });
  }

  function updateDataChannelUri(value: string) {
    setDataChannelUri(value);
    persist({ dataChannelUri: value });
  }

  function commitScreens(next: WhatsAppFlowScreen[]) {
    setScreens(next);
    persist({ screens: next });
  }

  function addScreen() {
    if (screens.length >= FLOW_LIMITS.maxScreens) {
      toast({
        level: 'warn',
        message: `Limite de ${FLOW_LIMITS.maxScreens} screens atingido`,
        detail: 'Use Switch/If pra ramificar dentro das screens existentes.',
      });
      return;
    }
    const newScreen = createBlankScreen({
      title: `Tela ${screens.length + 1}`,
    });
    const next = [...screens, newScreen];
    commitScreens(next);
    setSelectedScreenId(newScreen.id);
  }

  function deleteScreen(id: string) {
    if (screens.length <= 1) {
      toast({ level: 'warn', message: 'O Flow precisa ter ao menos 1 screen' });
      return;
    }
    const next = screens.filter((s) => s.id !== id);
    // Se a screen deletada era entry, promover a primeira a entry.
    if (!next.some((s) => s.isEntry)) {
      next[0] = { ...next[0], isEntry: true };
    }
    commitScreens(next);
    if (selectedScreenId === id) {
      setSelectedScreenId(next[0]?.id ?? null);
    }
  }

  function updateScreenTitle(id: string, title: string) {
    const v = title.slice(0, FLOW_LIMITS.screenTitle);
    commitScreens(
      screens.map((s) => (s.id === id ? { ...s, title: v } : s))
    );
  }

  function setEntryScreen(id: string) {
    commitScreens(
      screens.map((s) => ({ ...s, isEntry: s.id === id }))
    );
  }

  function toggleTerminal(id: string) {
    commitScreens(
      screens.map((s) => (s.id === id ? { ...s, isTerminal: !s.isTerminal } : s))
    );
  }

  // ----- Component handlers (#207/#208/#209) -----------------------------

  /** Adiciona um component novo no final da screen ativa. */
  function addComponent(type: WhatsAppFlowComponentType) {
    if (!selectedScreen) return;
    const newComp = createComponent(type);
    const updatedScreen: WhatsAppFlowScreen = {
      ...selectedScreen,
      components: [...selectedScreen.components, newComp],
    };
    commitScreens(
      screens.map((s) => (s.id === selectedScreen.id ? updatedScreen : s))
    );
    setSelectedComponentId(newComp.id);
  }

  /** Atualiza um component da screen ativa (após edição no inspector). */
  function updateComponent(updated: WhatsAppFlowComponent) {
    if (!selectedScreen) return;
    const updatedScreen: WhatsAppFlowScreen = {
      ...selectedScreen,
      components: selectedScreen.components.map((c) =>
        c.id === updated.id ? updated : c
      ),
    };
    commitScreens(
      screens.map((s) => (s.id === selectedScreen.id ? updatedScreen : s))
    );
  }

  /** Remove um component da screen ativa. */
  function deleteComponent(componentId: string) {
    if (!selectedScreen) return;
    const updatedScreen: WhatsAppFlowScreen = {
      ...selectedScreen,
      components: selectedScreen.components.filter((c) => c.id !== componentId),
    };
    commitScreens(
      screens.map((s) => (s.id === selectedScreen.id ? updatedScreen : s))
    );
    if (selectedComponentId === componentId) setSelectedComponentId(null);
  }

  /** Reordena: move o component pra cima (idx → idx-1) ou pra baixo. */
  function moveComponent(componentId: string, direction: 'up' | 'down') {
    if (!selectedScreen) return;
    const idx = selectedScreen.components.findIndex((c) => c.id === componentId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= selectedScreen.components.length) return;
    const next = [...selectedScreen.components];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const updatedScreen: WhatsAppFlowScreen = {
      ...selectedScreen,
      components: next,
    };
    commitScreens(
      screens.map((s) => (s.id === selectedScreen.id ? updatedScreen : s))
    );
  }

  // ----- Render ----------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
          <span className="text-xl">📋</span>
          <div className="flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => updateName(e.target.value)}
              maxLength={FLOW_LIMITS.flowName}
              placeholder="Nome do Flow"
              className="w-full bg-transparent text-lg font-semibold placeholder-white/60 focus:outline-none"
            />
            <p className="text-[11px] text-white/80">
              WhatsApp Flow · v{node.data?.flowJsonVersion ?? '7.1'}
            </p>
          </div>
          {/* Status indicator de salvamento — "Salvo · há X" ou animação */}
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />

          {/* Botão Salvar (força salvamento + feedback visual). Atalho Ctrl+S */}
          <button
            type="button"
            onClick={saveNow}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white/20 hover:bg-white/30 text-white transition disabled:opacity-50"
            title="Salvar agora (Ctrl+S / ⌘S)"
          >
            <Save size={12} />
            Salvar
          </button>

          {/* Toggle Edit/Preview — alterna entre modo edição e mockup interativo */}
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
              previewMode
                ? 'bg-white/20 hover:bg-white/30 text-white'
                : 'bg-emerald-700/40 hover:bg-emerald-700/50 text-white'
            }`}
            title={previewMode ? 'Voltar pra edição' : 'Testar Flow (preview interativo)'}
          >
            {previewMode ? (
              <>
                <Pencil size={12} /> Editar
              </>
            ) : (
              <>
                <Play size={12} /> Preview
              </>
            )}
          </button>

          {/* Badge de validação — clica pra ver detalhes */}
          <button
            type="button"
            onClick={() => setJsonPreviewOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
              errorCount > 0
                ? 'bg-rose-500/30 text-white hover:bg-rose-500/40'
                : warnCount > 0
                  ? 'bg-amber-500/30 text-white hover:bg-amber-500/40'
                  : 'bg-emerald-700/40 text-white hover:bg-emerald-700/50'
            }`}
            title={
              errorCount > 0
                ? `${errorCount} erro${errorCount === 1 ? '' : 's'}, ${warnCount} aviso${warnCount === 1 ? '' : 's'}`
                : warnCount > 0
                  ? `${warnCount} aviso${warnCount === 1 ? '' : 's'}`
                  : 'Flow OK — pronto pra exportar'
            }
          >
            {errorCount > 0 ? (
              <>
                <AlertTriangle size={12} /> {errorCount} erro{errorCount === 1 ? '' : 's'}
              </>
            ) : warnCount > 0 ? (
              <>
                <AlertTriangle size={12} /> {warnCount} aviso{warnCount === 1 ? '' : 's'}
              </>
            ) : (
              <>
                <CheckCircle2 size={12} /> OK
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setJsonPreviewOpen(true)}
            className="p-2 rounded-md hover:bg-white/20 transition"
            title="Ver Flow JSON gerado"
            aria-label="Ver Flow JSON"
          >
            <Code2 size={18} />
          </button>
          <button
            type="button"
            onClick={downloadFlowJson}
            className="p-2 rounded-md hover:bg-white/20 transition"
            title="Baixar Flow JSON"
            aria-label="Baixar Flow JSON"
          >
            <Download size={18} />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-md hover:bg-white/20 transition"
            title="Fechar"
            aria-label="Fechar sub-editor"
          >
            <X size={20} />
          </button>
        </header>

        {/* BODY — split em 3 colunas (sidebars escondem em preview mode) */}
        <div className="flex-1 flex overflow-hidden">
          {/* SIDEBAR — lista de screens + paleta de components (oculta em preview) */}
          {!previewMode && (
          <aside className="w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                Telas ({screens.length}/{FLOW_LIMITS.maxScreens})
              </span>
              <button
                type="button"
                onClick={addScreen}
                className="text-emerald-600 hover:text-emerald-700 disabled:opacity-30"
                disabled={screens.length >= FLOW_LIMITS.maxScreens}
                title="Adicionar tela"
                aria-label="Adicionar tela"
              >
                <Plus size={16} />
              </button>
            </div>
            <ul className="overflow-y-auto p-2 space-y-1 max-h-[50%]">
              {screens.map((s, i) => {
                const isSelected = s.id === selectedScreenId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScreenId(s.id);
                        setSelectedComponentId(null);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-md border text-xs transition ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 font-mono text-[10px]">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="flex-1 font-medium text-gray-800 dark:text-gray-100 truncate">
                          {s.title || '(sem título)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {s.isEntry && (
                          <span
                            className="inline-flex items-center text-[9px] font-semibold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded"
                            title="Tela inicial"
                          >
                            <Star size={9} className="mr-0.5" /> entry
                          </span>
                        )}
                        {s.isTerminal && (
                          <span
                            className="inline-flex items-center text-[9px] font-semibold text-rose-700 bg-rose-100 px-1 py-0.5 rounded"
                            title="Tela final (action: complete)"
                          >
                            <Flag size={9} className="mr-0.5" /> terminal
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 ml-auto">
                          {s.components.length} comp.
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Paleta de componentes — só ativa se há screen selecionada */}
            <div className="flex-1 overflow-y-auto">
              <FlowComponentPalette
                onAdd={addComponent}
                disabled={!selectedScreen}
              />
            </div>
          </aside>
          )}

          {/* CENTRO — mockup. Em preview mode: runtime interativo; senão: editor */}
          <main className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-950 overflow-y-auto py-6">
            {previewMode ? (
              <FlowPreviewRuntime
                screens={screens}
                flowName={name}
                dataChannelUri={dataChannelUri}
              />
            ) : selectedScreen ? (
              <ScreenMockup
                screen={selectedScreen}
                flowName={name}
                selectedComponentId={selectedComponentId}
                onSelectComponent={setSelectedComponentId}
              />
            ) : (
              <div className="text-gray-400 text-sm">Nenhuma tela selecionada</div>
            )}
          </main>

          {/* INSPECTOR — component selecionado (se houver) + props da screen + props gerais do Flow (oculto em preview) */}
          {!previewMode && (
          <aside className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-900">
            {selectedComponent && selectedScreen ? (
              <FlowComponentInspector
                component={selectedComponent}
                screens={screens}
                onChange={updateComponent}
                onDelete={() => deleteComponent(selectedComponent.id)}
                onMoveUp={() => moveComponent(selectedComponent.id, 'up')}
                onMoveDown={() => moveComponent(selectedComponent.id, 'down')}
                canMoveUp={
                  selectedScreen.components.findIndex((c) => c.id === selectedComponent.id) > 0
                }
                canMoveDown={
                  selectedScreen.components.findIndex((c) => c.id === selectedComponent.id) <
                  selectedScreen.components.length - 1
                }
              />
            ) : null}

            {selectedScreen ? (
              <ScreenInspector
                screen={selectedScreen}
                onUpdateTitle={(v) => updateScreenTitle(selectedScreen.id, v)}
                onSetEntry={() => setEntryScreen(selectedScreen.id)}
                onToggleTerminal={() => toggleTerminal(selectedScreen.id)}
                onDelete={() => deleteScreen(selectedScreen.id)}
                canDelete={screens.length > 1}
              />
            ) : null}

            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Propriedades do Flow
              </h3>
              <Field label="Categoria (Meta)">
                <select
                  value={category}
                  onChange={(e) => updateCategory(e.target.value as WhatsAppFlowCategory)}
                  className={inputCls}
                >
                  {FLOW_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {FLOW_CATEGORIES.find((c) => c.value === category)?.description}
                </p>
              </Field>
              <Field label="Endpoint pra data_exchange (opcional)">
                <input
                  type="text"
                  value={dataChannelUri}
                  onChange={(e) => updateDataChannelUri(e.target.value)}
                  placeholder="https://api.suaempresa.com/whatsapp/flow"
                  className={`${inputCls} font-mono text-[11px]`}
                />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  POST endpoint que recebe dados das actions `data_exchange`. Vazio = Flow client-only (só navigate + complete).
                </p>
              </Field>
              <Field label={`Texto do botão (${triggerLabel.length}/${FLOW_LIMITS.triggerLabel})`}>
                <input
                  type="text"
                  value={triggerLabel}
                  onChange={(e) => updateTrigger(e.target.value)}
                  maxLength={FLOW_LIMITS.triggerLabel}
                  placeholder="Abrir"
                  className={inputCls}
                />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Botão que abre o Flow no chat (interactive flow message).
                </p>
              </Field>
            </div>
          </aside>
          )}
        </div>
      </div>

      {/* Modal de JSON preview / validação */}
      {jsonPreviewOpen && node && (
        <JsonPreviewModal
          node={node}
          problems={validationProblems}
          onClose={() => setJsonPreviewOpen(false)}
          onDownload={downloadFlowJson}
        />
      )}
    </div>
  );
}

// =============================================================================
// SaveStatusIndicator — feedback compacto "Salvo · há X" / "Salvando" / "Editado"
// =============================================================================

function SaveStatusIndicator({
  status,
  lastSavedAt,
}: {
  status: 'idle' | 'dirty' | 'saving' | 'saved';
  lastSavedAt: string | null;
}) {
  const timeAgo = formatTimeAgo(lastSavedAt);

  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-white/90 px-2">
        <Loader2 size={12} className="animate-spin" />
        Salvando…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-emerald-100 px-2">
        <CheckCircle2 size={12} />
        Salvo
      </span>
    );
  }
  if (status === 'dirty') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-amber-100 px-2">
        <Loader2 size={12} className="animate-spin" />
        Salvando…
      </span>
    );
  }
  // idle
  return (
    <span
      className="flex items-center gap-1.5 text-[11px] text-white/70 px-2"
      title={lastSavedAt ? `Última edição: ${new Date(lastSavedAt).toLocaleString('pt-BR')}` : ''}
    >
      <CheckCircle2 size={12} />
      {timeAgo ? `Salvo ${timeAgo}` : 'Salvo'}
    </span>
  );
}

// =============================================================================
// Modal de preview do Flow JSON + relatório de validação
// =============================================================================

function JsonPreviewModal({
  node,
  problems,
  onClose,
  onDownload,
}: {
  node: FluxoNode;
  problems: FlowValidationProblem[];
  onClose: () => void;
  onDownload: () => void;
}) {
  const json = useMemo(() => buildFlowJson(node.data), [node.data]);
  const jsonStr = useMemo(() => JSON.stringify(json, null, 2), [json]);
  const errors = problems.filter((p) => p.severity === 'error');
  const warnings = problems.filter((p) => p.severity === 'warning');

  async function copy() {
    try {
      await navigator.clipboard.writeText(jsonStr);
      toast({ level: 'success', message: 'JSON copiado pra área de transferência' });
    } catch {
      toast({ level: 'error', message: 'Falha ao copiar' });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Code2 size={18} className="text-emerald-600" />
          <h3 className="flex-1 font-semibold text-gray-900 dark:text-gray-100">
            Flow JSON (Meta v{node.data.flowJsonVersion ?? '7.1'})
          </h3>
          <button
            type="button"
            onClick={copy}
            className="text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Copiar
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="text-xs px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium flex items-center gap-1"
          >
            <Download size={12} /> Baixar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </header>

        {/* Relatório de validação */}
        {(errors.length > 0 || warnings.length > 0) && (
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 space-y-1.5 max-h-40 overflow-y-auto">
            {errors.map((p, i) => (
              <div
                key={`e${i}`}
                className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-400"
              >
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{p.message}</span>
              </div>
            ))}
            {warnings.map((p, i) => (
              <div
                key={`w${i}`}
                className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{p.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* JSON */}
        <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono leading-snug text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950">
          {jsonStr}
        </pre>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-componentes
// =============================================================================

const inputCls =
  'w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function ScreenMockup({
  screen,
  flowName,
  selectedComponentId,
  onSelectComponent,
}: {
  screen: WhatsAppFlowScreen;
  flowName: string;
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
}) {
  return (
    <div
      className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
      style={{ width: 320, minHeight: 560, maxHeight: '80vh' }}
    >
      {/* Status bar fake */}
      <div className="bg-emerald-700 text-white text-[10px] px-3 py-1 flex justify-between">
        <span>9:41</span>
        <span>WhatsApp</span>
        <span>100%</span>
      </div>
      {/* Header da screen */}
      <div className="bg-emerald-600 text-white px-4 py-3 flex items-center gap-2">
        <span className="text-base leading-none">📋</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] opacity-80 truncate">{flowName}</div>
          <div className="text-sm font-semibold truncate">{screen.title}</div>
        </div>
      </div>
      {/* Body — components reais. Click no fundo deseleciona. */}
      <div
        className="flex-1 p-4 overflow-y-auto"
        onClick={() => onSelectComponent(null)}
      >
        {screen.components.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="text-3xl mb-2">📝</div>
            <p className="text-xs text-gray-500">
              Tela vazia. Use a paleta à esquerda pra adicionar componentes.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {screen.components.map((c) => (
              <div
                key={c.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectComponent(c.id);
                }}
              >
                <FlowComponentPreview
                  component={c}
                  selected={c.id === selectedComponentId}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenInspector({
  screen,
  onUpdateTitle,
  onSetEntry,
  onToggleTerminal,
  onDelete,
  canDelete,
}: {
  screen: WhatsAppFlowScreen;
  onUpdateTitle: (v: string) => void;
  onSetEntry: () => void;
  onToggleTerminal: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  return (
    <div className="px-4 py-3 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Tela selecionada
      </h3>
      <Field label={`Título (${screen.title.length}/${FLOW_LIMITS.screenTitle})`}>
        <input
          type="text"
          value={screen.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          maxLength={FLOW_LIMITS.screenTitle}
          className={inputCls}
        />
      </Field>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSetEntry}
          disabled={screen.isEntry}
          className={`flex-1 text-xs px-2 py-1.5 rounded-md border font-medium ${
            screen.isEntry
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-default'
              : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'
          }`}
          title="Marca como tela inicial do Flow"
        >
          <Star size={12} className="inline mr-1" />
          {screen.isEntry ? 'É a tela inicial' : 'Marcar como inicial'}
        </button>
      </div>
      <button
        type="button"
        onClick={onToggleTerminal}
        className={`w-full text-xs px-2 py-1.5 rounded-md border font-medium ${
          screen.isTerminal
            ? 'bg-rose-50 border-rose-300 text-rose-700'
            : 'border-gray-200 dark:border-gray-700 hover:border-rose-300'
        }`}
        title="Tela terminal — action complete (encerra o Flow)"
      >
        <Flag size={12} className="inline mr-1" />
        {screen.isTerminal ? 'É tela terminal' : 'Marcar como terminal'}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        className="w-full text-xs px-2 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed font-medium"
      >
        <Trash2 size={12} className="inline mr-1" /> Apagar tela
      </button>
    </div>
  );
}
