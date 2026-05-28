/**
 * Rota DEV-ONLY pra inspecionar o `ComponentsSection` sem auth.
 *
 * Carrega specs builtins direto do filesystem (server-side) e renderiza a UI
 * com origem=builtin pra testar a modal de "Editar componente". Útil pra
 * iterar visualmente em ajustes da UI sem precisar logar no Supabase.
 *
 * Bloqueada em produção pelo próprio handler.
 */

import ComponentsSection from '../../dashboard/ComponentsSection';
import { loadBuiltinSpecs } from '@/lib/component-specs/loader';
import type { ListedSpec } from '@/lib/actions/component-specs';

export const dynamic = 'force-dynamic';

export default function DevPreviewComponentsPage() {
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="p-6 text-gray-700">
        Esta rota é apenas para desenvolvimento.
      </div>
    );
  }

  const builtins = loadBuiltinSpecs();
  const specs: ListedSpec[] = builtins.map((data) => ({
    data,
    source: 'builtin' as const,
  }));

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 inline-block">
        🧪 DEV PREVIEW — sem auth, builtins só-leitura via filesystem.
      </div>
      <ComponentsSection specs={specs} />
    </div>
  );
}
