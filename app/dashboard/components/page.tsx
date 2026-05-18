import { listComponentSpecs } from '@/lib/actions/component-specs';
import ComponentsSection from '../ComponentsSection';

export const dynamic = 'force-dynamic';

/**
 * Aba COMPONENTES da dashboard. Lista todos os specs (builtins + customs +
 * overrides) com possibilidade de criar/editar/clonar/deletar.
 *
 * Topbar e nav vivem em `../layout.tsx`.
 */
export default async function DashboardComponentsPage() {
  let specs: Awaited<ReturnType<typeof listComponentSpecs>> = [];
  let loadError: string | null = null;

  try {
    specs = await listComponentSpecs();
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : 'Falha desconhecida ao carregar.';
    console.warn('[dashboard/components] listComponentSpecs failed:', err);
  }

  if (loadError) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 max-w-2xl">
        <h2 className="font-semibold text-amber-900 mb-2">
          ⚠️ Tabela `component_specs` não encontrada
        </h2>
        <p className="text-sm text-amber-800 mb-3">
          A migration 008 (que cria a tabela) provavelmente não foi rodada no
          Supabase ainda. Erro:
        </p>
        <code className="block text-xs bg-white border border-amber-200 rounded p-2 text-amber-900 mb-3">
          {loadError}
        </code>
        <p className="text-sm text-amber-800">
          Pra resolver: abra o SQL Editor do Supabase e cole o conteúdo de{' '}
          <code className="text-xs bg-white border border-amber-200 rounded px-1">
            supabase/migrations/008_component_specs.sql
          </code>
          .
        </p>
      </div>
    );
  }

  return <ComponentsSection specs={specs} />;
}
