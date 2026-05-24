'use client';

/**
 * VoiceTonePanel — modal com 2 tabs:
 *   • "Perfil" — escolhe preset ou customiza descrição + exemplos
 *   • "Análise" — roda análise IA e mostra sugestões com diff aceitar/recusar
 *
 * Profile persistido em localStorage por projeto.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  Sparkles,
  Sparkles as SparklesIcon,
  Wand2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  analyzeVoiceTone,
  type AnalyzeVoiceMessage,
} from '@/lib/actions/voice-tone';
import {
  applyFieldPatch,
  extractContentRows,
} from '@/lib/content-table/extract-rows';
import {
  clearVoiceProfile,
  hasGlobalDefaultProfile,
  loadGlobalDefaultProfile,
  loadVoiceProfile,
  saveVoiceProfile,
} from '@/lib/voice-tone/profile-storage';
import {
  DEFAULT_PROFILE,
  VOICE_PRESETS,
  getPresetById,
} from '@/lib/voice-tone/presets';
import type {
  VoicePresetId,
  VoiceProfile,
  VoiceSeverity,
  VoiceSuggestion,
} from '@/lib/voice-tone/types';
import type { FluxoNode, FluxoNodeData } from '@/lib/types';
import { handleError, toast } from '@/lib/utils/errors';
import { track } from '@/lib/analytics/posthog';

interface VoiceTonePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  nodes: FluxoNode[];
  /** Aplica patch num node — pai resolve o setNodes. */
  onUpdate: (nodeId: string, patch: Partial<FluxoNodeData>) => void;
}

export default function VoiceTonePanel({
  open,
  onOpenChange,
  projectId,
  nodes,
  onUpdate,
}: VoiceTonePanelProps) {
  const [profile, setProfile] = useState<VoiceProfile>(DEFAULT_PROFILE);
  const [hasGlobal, setHasGlobal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'analysis'>('profile');
  const [suggestions, setSuggestions] = useState<VoiceSuggestion[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedCount, setAnalyzedCount] = useState(0);

  // Carrega profile ao abrir (fallback: global default → hardcoded)
  useEffect(() => {
    if (!open) return;
    setProfile(loadVoiceProfile(projectId));
    setHasGlobal(hasGlobalDefaultProfile());
  }, [open, projectId]);

  function resetToGlobal() {
    clearVoiceProfile(projectId);
    const next = loadGlobalDefaultProfile();
    setProfile(next);
    toast({
      level: 'success',
      message: 'Profile do projeto removido',
      detail: hasGlobal
        ? 'Usando o padrão global agora.'
        : 'Usando o padrão de fábrica (Casual próximo).',
    });
  }

  // Mensagens elegíveis pra análise — extrai do conteúdo do canvas
  const messages = useMemo<AnalyzeVoiceMessage[]>(() => {
    if (!open) return [];
    const rows = extractContentRows(nodes, {
      types: [
        'bubble-bot',
        'bubble-user',
        'menu',
        'btn-short',
        'btn-long',
        'direcionamento',
        'atendimento-humano',
      ],
    });
    return rows
      .filter((r) => r.value.trim().length > 0)
      .map<AnalyzeVoiceMessage>((r) => ({
        nodeId: r.nodeId,
        fieldPath: r.fieldPath,
        fieldLabel: r.fieldLabel,
        frameLabel: r.frameLabel,
        code: r.code,
        text: r.value,
      }));
  }, [open, nodes]);

  function selectPreset(id: VoicePresetId) {
    const preset = getPresetById(id);
    if (!preset) return;
    const next: VoiceProfile = {
      preset: id,
      description: preset.description,
      examples: preset.examples,
    };
    setProfile(next);
    saveVoiceProfile(projectId, next);
  }

  function updateDescription(value: string) {
    const next: VoiceProfile = {
      ...profile,
      description: value,
      preset: 'custom',
    };
    setProfile(next);
    saveVoiceProfile(projectId, next);
  }

  function updateExamples(value: string) {
    const lines = value
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const next: VoiceProfile = { ...profile, examples: lines, preset: 'custom' };
    setProfile(next);
    saveVoiceProfile(projectId, next);
  }

  async function runAnalysis() {
    if (analyzing) return;
    if (messages.length === 0) {
      toast({
        level: 'warn',
        message: 'Nada pra analisar',
        detail: 'Adicione bubbles, menus ou direcionamentos no fluxo antes.',
      });
      return;
    }
    setAnalyzing(true);
    setSuggestions(null);
    setActiveTab('analysis');
    try {
      track('voice_tone_analyzed', {
        preset: profile.preset,
        messagesCount: messages.length,
      });
      const result = await analyzeVoiceTone({ profile, messages });
      setSuggestions(result.suggestions);
      setAnalyzedCount(result.analyzedCount);
      if (result.suggestions.length === 0) {
        toast({
          level: 'success',
          message: 'Tom consistente!',
          detail: `${result.analyzedCount} mensagens analisadas. Nada destoou.`,
        });
      } else {
        toast({
          level: 'info',
          message: `${result.suggestions.length} sugestões`,
          detail: `de ${result.analyzedCount} mensagens analisadas`,
        });
      }
    } catch (err) {
      handleError(err, { context: 'voice-tone-analysis' });
    } finally {
      setAnalyzing(false);
    }
  }

  function acceptSuggestion(s: VoiceSuggestion) {
    // Patch o node original
    const node = nodes.find((n) => n.id === s.nodeId);
    const fakeData: Record<string, unknown> = {};
    if (s.fieldPath.includes('[')) {
      const arrKey = s.fieldPath.split('[')[0];
      const currentArr = (node?.data?.[arrKey] as string[]) ?? [];
      fakeData[arrKey] = currentArr;
    }
    const patched = applyFieldPatch(fakeData, s.fieldPath, s.suggested);
    onUpdate(s.nodeId, patched as Partial<FluxoNodeData>);

    // Remove da lista
    setSuggestions((prev) =>
      prev ? prev.filter((x) => x !== s) : null
    );
    track('voice_tone_accepted', { severity: s.severity });
  }

  function rejectSuggestion(s: VoiceSuggestion) {
    setSuggestions((prev) => (prev ? prev.filter((x) => x !== s) : null));
    track('voice_tone_rejected', { severity: s.severity });
  }

  function acceptAll() {
    if (!suggestions || suggestions.length === 0) return;
    suggestions.forEach((s) => acceptSuggestion(s));
    toast({
      level: 'success',
      message: `${suggestions.length} sugestões aplicadas`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[1100px] h-[90vh] dark:bg-gray-900 flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 dark:text-white">
            <Sparkles size={18} className="text-blip-purple" /> Voice & Tone (IA)
          </DialogTitle>
          <DialogDescription className="mt-1 dark:text-gray-400">
            Defina o tom desejado e a IA identifica mensagens que destoam,
            sugerindo reescritas curtas preservando o significado.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'profile' | 'analysis')}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="mx-5 mb-3 self-start">
            <TabsTrigger value="profile">Perfil do tom</TabsTrigger>
            <TabsTrigger value="analysis">
              Análise
              {suggestions && suggestions.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-blip-purple text-white">
                  {suggestions.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ───────────────────────── PERFIL ─────────────────────── */}
          <TabsContent value="profile" className="flex-1 overflow-y-auto px-5 pb-5 m-0">
            <ProfileTab
              profile={profile}
              messagesCount={messages.length}
              hasGlobal={hasGlobal}
              onSelectPreset={selectPreset}
              onChangeDescription={updateDescription}
              onChangeExamples={updateExamples}
              onAnalyze={runAnalysis}
              onResetToGlobal={resetToGlobal}
              analyzing={analyzing}
            />
          </TabsContent>

          {/* ───────────────────────── ANÁLISE ─────────────────────── */}
          <TabsContent value="analysis" className="flex-1 overflow-y-auto px-5 pb-5 m-0">
            <AnalysisTab
              suggestions={suggestions}
              analyzing={analyzing}
              analyzedCount={analyzedCount}
              messagesCount={messages.length}
              onAnalyze={runAnalysis}
              onAccept={acceptSuggestion}
              onReject={rejectSuggestion}
              onAcceptAll={acceptAll}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// TAB: PERFIL
// =============================================================================

interface ProfileTabProps {
  profile: VoiceProfile;
  messagesCount: number;
  hasGlobal: boolean;
  onSelectPreset: (id: VoicePresetId) => void;
  onChangeDescription: (value: string) => void;
  onChangeExamples: (value: string) => void;
  onAnalyze: () => void;
  onResetToGlobal: () => void;
  analyzing: boolean;
}

function ProfileTab({
  profile,
  messagesCount,
  hasGlobal,
  onSelectPreset,
  onChangeDescription,
  onChangeExamples,
  onAnalyze,
  onResetToGlobal,
  analyzing,
}: ProfileTabProps) {
  const examplesText = (profile.examples ?? []).join('\n');

  return (
    <div className="space-y-5">
      {/* Banner explicando hierarquia (projeto override do global) */}
      <div className="text-[11px] text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2 flex items-start gap-2">
        <span className="shrink-0">ℹ️</span>
        <div className="flex-1">
          O perfil abaixo vale <strong>só pra este projeto</strong>. Pra configurar um padrão global que se aplica a todos os projetos, vá em{' '}
          <a
            href="/dashboard/settings"
            target="_blank"
            rel="noreferrer"
            className="text-blip-purple hover:underline font-medium"
          >
            Dashboard → Configurações ↗
          </a>
          .{hasGlobal && ' Você já tem um padrão global definido.'}
        </div>
        {hasGlobal && (
          <button
            type="button"
            onClick={onResetToGlobal}
            className="shrink-0 text-[10px] text-blip-purple hover:underline font-medium"
            title="Remove o profile deste projeto e volta a usar o padrão global"
          >
            Usar padrão global
          </button>
        )}
      </div>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          1 · Escolha um preset (ou customize)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {VOICE_PRESETS.map((p) => {
            const active = profile.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset(p.id)}
                className={`text-left px-3 py-2.5 rounded-lg border transition ${
                  active
                    ? 'border-blip-purple bg-blip-purple/5 dark:bg-blip-purple/10 ring-2 ring-blip-purple/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blip-purple hover:bg-blip-purple/5 dark:hover:bg-blip-purple/10'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl shrink-0 mt-0.5">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {p.title}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                      {p.subtitle}
                    </div>
                  </div>
                  {active && <Check size={14} className="text-blip-purple shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          2 · Descrição do tom (vai pro prompt da IA)
        </h3>
        <textarea
          value={profile.description}
          onChange={(e) => onChangeDescription(e.target.value)}
          rows={8}
          className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-800 dark:text-white focus:border-blip-purple focus:outline-none focus:ring-2 focus:ring-blip-purple/20"
          placeholder="Descreva como o bot deve falar — formal/informal, emojis, regras, etc."
        />
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
          Tip: descreva regras claras (o que EVITAR vs o que PREFERIR). Quanto mais específico, melhor a análise.
        </p>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          3 · Exemplos do tom (1-3 frases representativas — opcional)
        </h3>
        <textarea
          value={examplesText}
          onChange={(e) => onChangeExamples(e.target.value)}
          rows={4}
          className="w-full text-sm font-mono border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-800 dark:text-white focus:border-blip-purple focus:outline-none focus:ring-2 focus:ring-blip-purple/20"
          placeholder={`Olá! 👋 Em que posso te ajudar?\nPronto! Anotei seu pedido ✓`}
        />
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
          Uma frase por linha. Exemplos ajudam a IA a calibrar o estilo.
        </p>
      </section>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {messagesCount} mensagens elegíveis no fluxo
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing || messagesCount === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blip-purple hover:bg-blip-purple-dark rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {analyzing ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Analisando…
            </>
          ) : (
            <>
              <Wand2 size={15} /> Analisar fluxo
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// TAB: ANÁLISE
// =============================================================================

interface AnalysisTabProps {
  suggestions: VoiceSuggestion[] | null;
  analyzing: boolean;
  analyzedCount: number;
  messagesCount: number;
  onAnalyze: () => void;
  onAccept: (s: VoiceSuggestion) => void;
  onReject: (s: VoiceSuggestion) => void;
  onAcceptAll: () => void;
}

function AnalysisTab({
  suggestions,
  analyzing,
  analyzedCount,
  messagesCount,
  onAnalyze,
  onAccept,
  onReject,
  onAcceptAll,
}: AnalysisTabProps) {
  // Estado inicial — antes de rodar
  if (suggestions === null && !analyzing) {
    return (
      <div className="text-center py-12">
        <SparklesIcon size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
          Pronto pra analisar
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-5">
          {messagesCount > 0
            ? `${messagesCount} mensagens serão enviadas pra IA`
            : 'Adicione mensagens ao fluxo antes'}
        </p>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={messagesCount === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blip-purple hover:bg-blip-purple-dark rounded-lg disabled:opacity-50 transition-colors"
        >
          <Wand2 size={15} /> Analisar fluxo
        </button>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="text-center py-16">
        <Loader2 size={32} className="animate-spin mx-auto text-blip-purple mb-3" />
        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
          Analisando mensagens com IA…
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Pode levar de 10 a 30 segundos
        </p>
      </div>
    );
  }

  if (suggestions && suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
          <Check size={24} className="text-green-600 dark:text-green-400" />
        </div>
        <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">
          Tom consistente!
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-5">
          {analyzedCount} mensagens analisadas — nada destoa do tom configurado.
        </p>
        <button
          type="button"
          onClick={onAnalyze}
          className="text-xs px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Analisar novamente
        </button>
      </div>
    );
  }

  // Sugestões
  return (
    <div>
      <div className="flex items-center justify-between mb-3 sticky top-0 bg-white dark:bg-gray-900 py-2 -mx-1 px-1 z-10">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {suggestions!.length} sugest{suggestions!.length === 1 ? 'ão' : 'ões'} ·{' '}
          {analyzedCount} mensagens analisadas
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAnalyze}
            className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Reanalisar
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="text-xs px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium"
          >
            ✓ Aplicar todas
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {suggestions!.map((s, i) => (
          <SuggestionCard
            key={`${s.nodeId}-${s.fieldPath}-${i}`}
            suggestion={s}
            onAccept={() => onAccept(s)}
            onReject={() => onReject(s)}
          />
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// SUGGESTION CARD
// =============================================================================

const severityStyles: Record<VoiceSeverity, { bg: string; label: string; emoji: string }> = {
  low: {
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    label: 'Pequeno ajuste',
    emoji: '💡',
  },
  medium: {
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    label: 'Destoa',
    emoji: '⚠️',
  },
  high: {
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    label: 'Choca com o tom',
    emoji: '🚨',
  },
};

interface SuggestionCardProps {
  suggestion: VoiceSuggestion;
  onAccept: () => void;
  onReject: () => void;
}

function SuggestionCard({ suggestion, onAccept, onReject }: SuggestionCardProps) {
  const sev = severityStyles[suggestion.severity];
  return (
    <li className={`border rounded-lg p-3 ${sev.bg}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 text-[11px]">
        <span className="font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
          {sev.emoji} {sev.label}
        </span>
        <span className="text-gray-500 dark:text-gray-400">·</span>
        <span className="text-gray-600 dark:text-gray-300">{suggestion.frameLabel}</span>
        {suggestion.code && (
          <span className="font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1 py-0 rounded">
            {suggestion.code}
          </span>
        )}
        <span className="text-gray-500 dark:text-gray-400">·</span>
        <span className="text-gray-500 dark:text-gray-400">{suggestion.fieldLabel}</span>
      </div>

      {/* Diff */}
      <div className="space-y-1.5">
        <div className="text-xs">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
            Atual
          </div>
          <div className="text-gray-700 dark:text-gray-300 line-through decoration-red-400/60 decoration-1 bg-white/60 dark:bg-gray-900/60 rounded px-2 py-1">
            {suggestion.original}
          </div>
        </div>
        <div className="text-xs">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
            Sugerido
          </div>
          <div className="text-gray-900 dark:text-gray-100 font-medium bg-white/60 dark:bg-gray-900/60 rounded px-2 py-1">
            {suggestion.suggested}
          </div>
        </div>
        <div className="flex items-start gap-1.5 text-[11px] text-gray-600 dark:text-gray-400 pt-1">
          <AlertCircle size={11} className="shrink-0 mt-0.5" />
          <span>{suggestion.reason}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-1.5 mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
        <button
          type="button"
          onClick={onReject}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-800"
        >
          <X size={12} /> Recusar
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-blip-purple text-white hover:bg-blip-purple-dark font-medium"
        >
          <Check size={12} /> Aplicar
        </button>
      </div>
    </li>
  );
}
