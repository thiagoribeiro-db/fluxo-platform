import VoiceToneSettings from './VoiceToneSettings';
import AIPromptSection from './AIPromptSection';
import AccessManagement from './AccessManagement';
import { listPlatformUsers } from '@/lib/actions/access';
import { getMyProfile, hasMinRole } from '@/lib/auth/roles';

/**
 * Página de Configurações do dashboard.
 *
 * Seções atuais:
 *  - Gerenciamento de Acessos (somente admin/superAdmin)
 *  - Voice & Tone padrão global
 *  - Parser IA — visualização do system prompt
 */
export default async function SettingsPage() {
  const me = await getMyProfile();
  const role = me?.platform_role ?? 'editor';
  const canManageAccess = hasMinRole(role, 'admin');

  const users = canManageAccess ? await listPlatformUsers() : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-600 mt-1">
          Preferências globais e gerenciamento da plataforma.
        </p>
      </header>

      {canManageAccess && (
        <AccessManagement
          users={users}
          myRole={role}
          myId={me!.id}
        />
      )}

      <VoiceToneSettings />

      <AIPromptSection />
    </div>
  );
}
