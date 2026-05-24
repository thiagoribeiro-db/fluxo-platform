import VoiceToneSettings from './VoiceToneSettings';

/**
 * Página de Configurações do dashboard.
 *
 * Por enquanto, abriga apenas a configuração de Voice & Tone padrão.
 * Futuro: outras prefs globais (idioma default, tema preferido, etc.).
 */
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-600 mt-1">
          Preferências globais aplicadas em todos os seus projetos novos.
        </p>
      </header>

      <VoiceToneSettings />
    </div>
  );
}
