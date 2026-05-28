'use client';

/**
 * Configurações de Voice & Tone GLOBAL — salva como padrão pro user.
 *
 * Esse profile é aplicado em projetos novos que ainda não têm um profile
 * próprio configurado (no editor). Cada projeto pode override esse padrão
 * salvando seu profile no editor (Toolbar → Editar → Voice & Tone).
 *
 * UI (reformulada em 2026-05):
 *   - Toggle global Editar/Visualizar no header
 *   - 1 grid de presets (5 opções)
 *   - Cards estruturados por seção (Persona, Quando usar, Quando NÃO usar,
 *     PREFERIR, EVITAR, Casos de uso, Descrição derivada)
 *   - Markdown nos textareas com toggle local Editar/Preview por seção
 *
 * Persistência: campo `voice_profile_default jsonb` em `profiles` (migration 011).
 * Cache local em localStorage (`fluxo-voice-profile-default`) pro editor ler
 * síncrono.
 */
import { Check, Loader2, RotateCcw, Save, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { handleError, toast } from '@/lib/utils/errors';
import {
  clearGlobalVoiceProfileDB,
  loadGlobalVoiceProfileDB,
  saveGlobalVoiceProfileDB,
} from '@/lib/actions/voice-profile';
import {
  saveGlobalDefaultProfile,
  clearGlobalDefaultProfile,
} from '@/lib/voice-tone/profile-storage';
import {
  DEFAULT_PROFILE,
  VOICE_PRESETS,
  getPresetById,
  structuredToDescription,
} from '@/lib/voice-tone/presets';
import type {
  VoicePresetId,
  VoiceProfile,
  VoiceStructuredContent,
  VoiceUseCase,
} from '@/lib/voice-tone/types';
import { confirmDialog } from '@/lib/utils/dialog';
import {
  MarkdownTextField,
  SectionCard,
  AutoGrowTextarea,
  inputCls,
} from '@/components/ui/markdown-fields';
import {
  bulletsToMarkdown,
  markdownToBullets,
  renderBulletMarkdown,
} from '@/lib/utils/bullet-markdown';

export default function VoiceToneSettings() {
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [hasCustomGlobal, setHasCustomGlobal] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);
  const [saving, setSaving] = useState(false);
  // Modo global: 'read' (default — bom pra revisar) ou 'edit' (textareas ativos)
  const [viewMode, setViewMode] = useState<'edit' | 'read'>('read');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fromDb = await loadGlobalVoiceProfileDB();
        if (cancelled) return;
        if (fromDb) {
          // Backfill `structured` quando profile legado não tem
          const filled = fromDb.structured
            ? fromDb
            : { ...fromDb, structured: getPresetById(fromDb.preset)?.structured };
          setProfile(filled);
          setHasCustomGlobal(true);
        } else {
          setProfile(DEFAULT_PROFILE);
          setHasCustomGlobal(false);
        }
      } catch (err) {
        if (cancelled) return;
        handleError(err, { context: 'load-voice-profile', toast: false });
        setProfile(DEFAULT_PROFILE);
        setHasCustomGlobal(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
        <Loader2 size={20} className="animate-spin mx-auto mb-2" />
        Carregando…
      </div>
    );
  }

  const isReadOnly = viewMode === 'read';
  const structured: VoiceStructuredContent = profile.structured ?? {};

  function selectPreset(id: VoicePresetId) {
    const preset = getPresetById(id);
    if (!preset) return;
    const next: VoiceProfile = {
      preset: id,
      description: preset.description,
      examples: preset.examples,
      structured: preset.structured,
    };
    setProfile(next);
  }

  /** Atualiza um campo do `structured` e re-deriva description. */
  function updateStructured<K extends keyof VoiceStructuredContent>(
    key: K,
    value: VoiceStructuredContent[K]
  ) {
    setProfile((p) => {
      if (!p) return p;
      const newStructured: VoiceStructuredContent = {
        ...(p.structured ?? {}),
        [key]: value,
      };
      return {
        ...p,
        preset: 'custom',
        structured: newStructured,
        description: structuredToDescription(newStructured, p.description),
      };
    });
  }

  function updateExamples(value: string) {
    const lines = value
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    setProfile((p) => (p ? { ...p, examples: lines } : p));
  }

  async function handleSave() {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await saveGlobalVoiceProfileDB(profile);
      saveGlobalDefaultProfile(profile);
      setHasCustomGlobal(true);
      setSavedRecently(true);
      setTimeout(() => setSavedRecently(false), 2500);
      toast({
        level: 'success',
        message: 'Padrão salvo',
        detail: 'Sincronizado entre todos seus dispositivos.',
      });
    } catch (err) {
      handleError(err, { context: 'save-voice-profile' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    const ok = await confirmDialog({
      title: 'Restaurar padrão de fábrica?',
      message:
        'O padrão atual configurado será removido. Projetos novos voltarão a usar "Casual próximo" como base.\n\nProjetos existentes que já têm profile próprio NÃO são afetados.',
      confirmText: 'Restaurar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await clearGlobalVoiceProfileDB();
      clearGlobalDefaultProfile();
      setProfile(DEFAULT_PROFILE);
      setHasCustomGlobal(false);
      toast({ level: 'success', message: 'Padrão restaurado' });
    } catch (err) {
      handleError(err, { context: 'clear-voice-profile' });
    }
  }

  const examplesText = (profile.examples ?? []).join('\n');
  const persona = structured.persona ?? '';
  const whenToUseMd = bulletsToMarkdown(structured.whenToUse);
  const whenNotToUseMd = bulletsToMarkdown(structured.whenNotToUse);
  const dosMd = bulletsToMarkdown(structured.dos);
  const dontsMd = bulletsToMarkdown(structured.donts);

  return (
    <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header — toggle Editar/Visualizar */}
      <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={18} className="text-blip-purple shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              Voice &amp; Tone padrão
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              Tom usado pela IA em projetos novos — pode ser overridado em cada
              projeto pelo editor.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasCustomGlobal && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-green-700 bg-green-100 px-2 py-0.5 rounded">
              <Check size={11} /> Configurado
            </span>
          )}
          {/* Toggle Editar / Visualizar */}
          <div className="flex items-center gap-0.5 bg-gray-100 border border-gray-200 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`text-xs font-semibold px-2.5 py-1 rounded transition ${
                !isReadOnly
                  ? 'bg-white text-blip-purple-dark shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
              title="Modo edição — modifique campos"
            >
              ✏️ Editar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('read')}
              className={`text-xs font-semibold px-2.5 py-1 rounded transition ${
                isReadOnly
                  ? 'bg-white text-blip-purple-dark shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
              title="Modo leitura — markdown renderizado"
            >
              👁️ Visualizar
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-5 bg-gray-50/40">
        {/* === SEÇÃO: Preset picker === */}
        <SectionCard
          icon="🎨"
          title="Preset base"
          hint="Escolha um preset ou customize. Edições viram preset 'custom'."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {VOICE_PRESETS.map((p) => {
              const active = profile.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p.id)}
                  disabled={isReadOnly}
                  className={`text-left px-3 py-2.5 rounded-lg border transition ${
                    active
                      ? 'border-blip-purple bg-blip-purple/5 ring-2 ring-blip-purple/30'
                      : 'border-gray-200 hover:border-blip-purple hover:bg-blip-purple/5'
                  } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl shrink-0 mt-0.5">{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {p.title}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                        {p.subtitle}
                      </div>
                    </div>
                    {active && (
                      <Check size={14} className="text-blip-purple shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {profile.preset === 'custom' && (
            <p className="text-[11px] text-blip-purple-dark mt-3 italic">
              Este é um profile <strong>custom</strong> — derivado de edições
              manuais. Selecione um preset acima pra restaurar a base.
            </p>
          )}
        </SectionCard>

        {/* === SEÇÃO: Persona === */}
        <SectionCard
          icon="🎭"
          title="Persona"
          hint="A 'voz' do bot nesse tom — frase curta."
          tone="purple"
        >
          {isReadOnly ? (
            <div className="text-sm text-gray-800 leading-relaxed bg-white border border-gray-200 rounded-md p-3 min-h-[44px]">
              {persona ? (
                renderBulletMarkdown(persona)
              ) : (
                <span className="text-xs text-gray-400 italic">Vazio.</span>
              )}
            </div>
          ) : (
            <AutoGrowTextarea
              value={persona}
              onChange={(v) => updateStructured('persona', v)}
              minRows={2}
              placeholder='Ex: "Colega prestativo — alguém que conhece o assunto mas conversa como amigo."'
              className={inputCls + ' text-sm leading-relaxed'}
            />
          )}
        </SectionCard>

        {/* === SEÇÃO: Quando usar === */}
        <MarkdownTextField
          icon="🎯"
          label="Quando usar este tom"
          hint="Indústrias, situações, contextos ideais."
          value={whenToUseMd}
          onChange={(v) => updateStructured('whenToUse', markdownToBullets(v))}
          placeholder={
            '- Varejo — moda, eletrônicos, e-commerce\n- Marcas com DNA jovem-adulto (25-45)\n- Atendimento direto pós-venda'
          }
          tone="emerald"
          forceMode={isReadOnly ? 'preview' : undefined}
        />

        {/* === SEÇÃO: Quando NÃO usar === */}
        <MarkdownTextField
          icon="🚫"
          label="Quando NÃO usar"
          hint="Contextos onde esse tom seria errado — escolha outro preset."
          value={whenNotToUseMd}
          onChange={(v) =>
            updateStructured('whenNotToUse', markdownToBullets(v))
          }
          placeholder={
            '- Bancos, seguros, jurídico — usar `formal-tecnico`\n- Saúde com paciente vulnerável — usar `amigavel-leve`'
          }
          tone="rose"
          forceMode={isReadOnly ? 'preview' : undefined}
        />

        {/* === SEÇÃO: PREFERIR === */}
        <MarkdownTextField
          icon="✅"
          label="PREFERIR"
          hint="Vocabulário, ritmo, marcadores positivos."
          value={dosMd}
          onChange={(v) => updateStructured('dos', markdownToBullets(v))}
          placeholder={
            '- Tratar por "você" (ou "tu" se for regionalismo)\n- Contrações naturais: `tá`, `pra`\n- 1-2 emojis em momentos-chave'
          }
          tone="emerald"
          forceMode={isReadOnly ? 'preview' : undefined}
        />

        {/* === SEÇÃO: EVITAR === */}
        <MarkdownTextField
          icon="⚠️"
          label="EVITAR"
          hint="Linguagem, marcadores, comportamentos que destoam do tom."
          value={dontsMd}
          onChange={(v) => updateStructured('donts', markdownToBullets(v))}
          placeholder={
            '- Linguagem rebuscada — `outrossim`, `precipuamente`\n- Frases longas com várias orações\n- Vocativos formais — `Prezado(a)`'
          }
          tone="amber"
          forceMode={isReadOnly ? 'preview' : undefined}
        />

        {/* === SEÇÃO: Casos de uso === */}
        <SectionCard
          icon="💬"
          title="Casos de uso (contextualizados)"
          hint="Frases exemplares amarradas a situações típicas."
          tone="blue"
          badge={
            structured.useCases && structured.useCases.length > 0
              ? String(structured.useCases.length)
              : undefined
          }
          headerExtra={
            !isReadOnly ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = [
                    ...(structured.useCases ?? []),
                    { context: '', example: '' },
                  ];
                  updateStructured('useCases', next);
                }}
                className="text-[10px] font-semibold text-blue-700 hover:text-blue-900 px-2 py-0.5"
              >
                + Caso
              </button>
            ) : null
          }
        >
          <UseCasesEditor
            items={structured.useCases ?? []}
            onChange={(next) => updateStructured('useCases', next)}
            readOnly={isReadOnly}
          />
        </SectionCard>

        {/* === SEÇÃO: Exemplos legacy === */}
        <SectionCard
          icon="📝"
          title="Exemplos (legacy)"
          hint="Frases livres — uma por linha. Opcional, mantida pra compatibilidade."
          collapsibleDefaultOpen={examplesText.trim().length > 0}
        >
          {isReadOnly ? (
            <div className="text-sm text-gray-800 leading-relaxed bg-white border border-gray-200 rounded-md p-3 min-h-[44px]">
              {examplesText.trim() ? (
                <ul className="list-disc pl-5 space-y-1">
                  {(profile.examples ?? []).map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-xs text-gray-400 italic">
                  Nenhum exemplo livre — use Casos de uso acima.
                </span>
              )}
            </div>
          ) : (
            <AutoGrowTextarea
              value={examplesText}
              onChange={updateExamples}
              minRows={3}
              placeholder={`Olá! 👋 Em que posso te ajudar?\nPronto! Anotei seu pedido ✓`}
              className={inputCls + ' font-mono text-[12px] leading-relaxed'}
            />
          )}
        </SectionCard>

        {/* === SEÇÃO: Descrição final (markdown derivado) === */}
        <SectionCard
          icon="🤖"
          title="Descrição gerada (vai pro prompt da IA)"
          hint="Markdown derivado dos campos acima — read-only."
          tone="gray"
          collapsibleDefaultOpen={false}
        >
          <div className="text-xs text-gray-600 prose prose-sm max-w-none bg-white border border-gray-200 rounded-md p-3 min-h-[80px]">
            {profile.description.trim() ? (
              renderBulletMarkdown(profile.description)
            ) : (
              <span className="italic text-gray-400">Vazio.</span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 italic">
            Esse texto é regenerado automaticamente quando você edita Persona /
            Quando usar / Preferir / Evitar / Casos de uso.
          </p>
        </SectionCard>
      </div>

      {/* Footer */}
      <footer className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasCustomGlobal && !isReadOnly && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white rounded-md border border-gray-300"
              title="Restaurar pro padrão de fábrica (Casual próximo)"
            >
              <RotateCcw size={12} /> Restaurar padrão
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {savedRecently && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <Check size={13} /> Salvo
            </span>
          )}
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blip-purple hover:bg-blip-purple-dark rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <Save size={14} /> Salvar padrão
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}

// ============================================================================
// UseCasesEditor — lista de pares context + example
// ============================================================================

function UseCasesEditor({
  items,
  onChange,
  readOnly,
}: {
  items: VoiceUseCase[];
  onChange: (next: VoiceUseCase[]) => void;
  readOnly: boolean;
}) {
  function updateItem(idx: number, patch: Partial<VoiceUseCase>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  if (items.length === 0) {
    return (
      <p className="text-xs text-gray-500 italic">
        Nenhum caso de uso ainda. {!readOnly && 'Adicione com o botão "+ Caso" no header.'}
      </p>
    );
  }

  if (readOnly) {
    return (
      <ul className="space-y-2.5">
        {items.map((uc, i) => (
          <li
            key={i}
            className="bg-white border border-blue-100 rounded-md p-3 text-sm"
          >
            <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide mb-1">
              {uc.context || '(sem contexto)'}
            </div>
            <div className="text-gray-800 leading-relaxed italic">
              &ldquo;{uc.example || '(sem exemplo)'}&rdquo;
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((uc, idx) => (
        <li
          key={idx}
          className="bg-white border border-blue-100 hover:border-blue-200 rounded-md p-2.5 transition group"
        >
          <div className="flex items-start gap-2">
            <span className="shrink-0 bg-blue-100 text-blue-800 w-6 h-6 rounded text-[11px] font-bold flex items-center justify-center mt-0.5">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0 space-y-1.5">
              <input
                type="text"
                value={uc.context}
                onChange={(e) => updateItem(idx, { context: e.target.value })}
                placeholder="Contexto (ex: Saudação inicial, Confirmação, Erro)"
                className={
                  inputCls +
                  ' text-[12px] font-semibold text-blue-900 placeholder:text-blue-300 placeholder:font-normal'
                }
              />
              <AutoGrowTextarea
                value={uc.example}
                onChange={(v) => updateItem(idx, { example: v })}
                minRows={1}
                placeholder='Frase no tom desejado, ex: "Oi! 👋 Em que posso te ajudar?"'
                className={inputCls + ' text-sm italic text-gray-800'}
              />
            </div>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="shrink-0 text-gray-400 hover:text-red-600 text-sm leading-none px-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remover"
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
