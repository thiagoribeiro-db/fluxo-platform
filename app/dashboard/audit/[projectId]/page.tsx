import Link from 'next/link';
import { listAuditEvents, type AuditAction } from '@/lib/actions/audit';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { projectId: string };
}

const ACTION_LABELS: Record<AuditAction, { icon: string; label: string }> = {
  'project.created': { icon: '✨', label: 'Projeto criado' },
  'project.deleted': { icon: '🗑', label: 'Projeto apagado' },
  'project.status_changed': { icon: '🔄', label: 'Status alterado' },
  'template.applied': { icon: '🌱', label: 'Template aplicado' },
  'version.created': { icon: '📸', label: 'Snapshot criado' },
  'version.restored': { icon: '⏮', label: 'Versão restaurada' },
  'share.created': { icon: '🔗', label: 'Link compartilhável criado' },
  'share.revoked': { icon: '⛔', label: 'Link revogado' },
  'page.created': { icon: '📄', label: 'Página criada' },
  'page.deleted': { icon: '📄', label: 'Página apagada' },
  'page.renamed': { icon: '📝', label: 'Página renomeada' },
};

export default async function AuditPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', params.projectId)
    .maybeSingle();

  if (!project) {
    return (
      <main className="p-8">
        <div className="text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="font-bold text-gray-900">Projeto não encontrado</h1>
          <Link href="/dashboard" className="mt-4 inline-block text-blip-purple hover:underline">
            ← Voltar pro dashboard
          </Link>
        </div>
      </main>
    );
  }

  const events = await listAuditEvents(params.projectId, { limit: 200 });

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard" className="text-xs text-blip-purple hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          📜 Histórico de ações — {project.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Registro de ações de governança (status, templates, shares, versões).{' '}
          {events.length === 0
            ? 'Sem eventos ainda.'
            : `${events.length} evento${events.length === 1 ? '' : 's'}.`}
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
          Nenhuma ação registrada — aplicações de template, mudanças de status
          e shares criados aparecerão aqui.
        </div>
      ) : (
        <ol className="space-y-2">
          {events.map((e) => {
            const meta = ACTION_LABELS[e.action] ?? {
              icon: '•',
              label: e.action,
            };
            return (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <span className="text-xl shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{meta.label}</span>
                    <span className="text-[10px] font-mono text-gray-400">
                      {e.action}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {e.user_display_name ?? 'Sistema'} ·{' '}
                    {new Date(e.created_at).toLocaleString('pt-BR')}
                  </div>
                  {e.details && Object.keys(e.details).length > 0 && (
                    <pre className="mt-1.5 text-[10px] text-gray-500 bg-gray-50 rounded px-2 py-1 overflow-x-auto">
                      {JSON.stringify(e.details, null, 0)}
                    </pre>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
