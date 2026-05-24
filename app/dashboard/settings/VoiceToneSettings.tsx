'use client';

/**
 * Configurações de Voice & Tone GLOBAL — salva como padrão pro user.
 *
 * Esse profile é aplicado em projetos novos que ainda não têm um profile
 * próprio configurado (no editor). Cada projeto pode override esse padrão
 * salvando seu profile no editor (Toolbar → Editar → Voice & Tone).
 *
 * Persistência: localStorage (`fluxo-voice-profile-default`). Futuro:
 * migrar pra Supabase quando virar feature consolidada.
 */
import { Check, Loader2, RotateCcw, Save, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/utils/errors';
import {
  clearGlobalDefaultProfile,
  hasGlobalDefaultProfile,
  loadGlobalDefaultProfile,
  saveGlobalDefaultProfile,
} from '@/lib/voice-tone/profile-storage';
import {
  DEFAULT_PROFILE,
  VOICE_PRESETS,
  getPresetById,
} from '@/lib/voice-tone/presets';
import type { VoicePresetId, VoiceProfile } from '@/lib/voice-tone/types';
import { confirmDialog } from '@/lib/utils/dialog';

export default function VoiceToneSettings() {
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [hasCustomGlobal, setHasCustomGlobal] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);

  // Carrega o profile no mount (client-only — localStorage)
  useEffect(() => {
    setProfile(loadGlobalDefaultProfile());
    setHasCustomGlobal(hasGlobalDefaultProfile());
  }, []);

  // Loading inicial — evita flicker
  if (!profile) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
        <Loader2 size={20} className="animate-spin mx-auto mb-2" />
        Carregando…
      </div>
    );
  }

  function selectPreset(id: VoicePresetId) {
    const preset = getPresetById(id);
    if (!preset) return;
    const next: VoiceProfile = {
      preset: id,
      description: preset.description,
      examples: preset.examples,
    };
    setProfile(next);
  }

  function updateDescription(value: string) {
    setProfile((p) => (p ? { ...p, description: value, preset: 'custom' } : p));
  }

  function updateExamples(value: string) {
    const lines = value
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    setProfile((p) => (p ? { ...p, examples: lines, preset: 'custom' } : p));
  }

  function handleSave() {
    if (!profile) return;
    saveGlobalDefaultProfile(profile);
    setHasCustomGlobal(true);
    setSavedRecently(true);
    setTimeout(() => setSavedRecently(false), 2500);
    toast({
      level: 'success',
      message: 'Padrão salvo',
      detail: 'Novos projetos vão usar esse perfil como ponto de partida.',
    });
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
    clearGlobalDefaultProfile();
    setProfile(DEFAULT_PROFILE);
    setHasCustomGlobal(false);
    toast({ level: 'success', message: 'Padrão restaurado' });
  }

  const examplesText = (profile.examples ?? []).join('\n');

  return (
    <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-blip-purple" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Voice &amp; Tone padrão
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Tom usado pela IA em projetos novos — pode ser overridado em cada projeto pelo editor.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {hasCustomGlobal && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-green-700 bg-green-100 px-2 py-0.5 rounded">
              <Check size={11} /> Configurado
            </span>
          )}
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Preset picker */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            1 · Escolha um preset (ou customize)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {VOICE_PRESETS.map((p) => {
              const active = profile.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p.id)}
                  className={`text-left px-3 py-2.5 rounded-lg border transition ${
                    active
                      ? 'border-blip-purple bg-blip-purple/5 ring-2 ring-blip-purple/30'
                      : 'border-gray-200 hover:border-blip-purple hover:bg-blip-purple/5'
                  }`}
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
                    {active && <Check size={14} className="text-blip-purple shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Descrição */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            2 · Descrição do tom (vai pro prompt da IA)
          </h3>
          <textarea
            value={profile.description}
            onChange={(e) => updateDescription(e.target.value)}
            rows={8}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-blip-purple focus:outline-none focus:ring-2 focus:ring-blip-purple/20"
            placeholder="Descreva como o bot deve falar — formal/informal, emojis, regras, etc."
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Tip: descreva regras claras (o que EVITAR vs o que PREFERIR). Quanto mais específico, melhor a análise.
          </p>
        </section>

        {/* Exemplos */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            3 · Exemplos do tom (1-3 frases representativas — opcional)
          </h3>
          <textarea
            value={examplesText}
            onChange={(e) => updateExamples(e.target.value)}
            rows={4}
            className="w-full text-sm font-mono border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-blip-purple focus:outline-none focus:ring-2 focus:ring-blip-purple/20"
            placeholder={`Olá! 👋 Em que posso te ajudar?\nPronto! Anotei seu pedido ✓`}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Uma frase por linha. Exemplos ajudam a IA a calibrar o estilo.
          </p>
        </section>
      </div>

      <footer className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasCustomGlobal && (
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
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blip-purple hover:bg-blip-purple-dark rounded-lg shadow-sm transition-colors"
          >
            <Save size={14} /> Salvar padrão
          </button>
        </div>
      </footer>
    </section>
  );
}
