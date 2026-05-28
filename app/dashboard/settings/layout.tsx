import { getMyProfile } from '@/lib/auth/roles';
import SettingsSidebar from './SettingsSidebar';

/**
 * Layout compartilhado da página de Configurações.
 *
 * Estrutura:
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Header (Configurações)                               │
 *   ├──────────────┬───────────────────────────────────────┤
 *   │ Sidebar      │ Conteúdo (children por sub-rota)      │
 *   │              │                                       │
 *   └──────────────┴───────────────────────────────────────┘
 *
 * Sub-rotas:
 *   /settings/acessos      → AccessManagement (Admin+ only)
 *   /settings/voice-tone   → VoiceToneSettings
 *   /settings/parser-ia    → AIPromptSection
 *   /settings              → redirect pra primeira seção visível pelo role
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMyProfile();
  const role = me?.platform_role ?? 'editor';

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-600 mt-1">
          Preferências globais e gerenciamento da plataforma.
        </p>
      </header>

      <div className="lg:flex lg:gap-8">
        <SettingsSidebar role={role} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
