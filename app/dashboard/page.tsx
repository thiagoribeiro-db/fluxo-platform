import Link from 'next/link';
import { listProjects } from '@/lib/actions/projects';
import NewProjectButton from './NewProjectButton';
import DeleteProjectButton from './DeleteProjectButton';
import EstimatedHoursInput from './EstimatedHoursInput';
import type { ProjectStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { status?: string };
}

const STATUS_FILTERS: Array<{ key: ProjectStatus | 'all'; label: string; icon: string }> = [
  { key: 'all', label: 'Todos', icon: '◯' },
  { key: 'draft', label: 'Rascunho', icon: '✏️' },
  { key: 'review', label: 'Em revisão', icon: '👀' },
  { key: 'approved', label: 'Aprovado', icon: '✓' },
  { key: 'archived', label: 'Arquivado', icon: '📦' },
];

/**
 * Aba PROJETOS da dashboard. Topbar e nav vivem em `layout.tsx`.
 */
export default async function DashboardProjetosPage({ searchParams }: PageProps) {
  const allProjects = await listProjects();
  // Filtro por status — `all` (ou ausente) mostra tudo
  const rawStatus = searchParams.status;
  const activeFilter: ProjectStatus | 'all' =
    rawStatus === 'draft' ||
    rawStatus === 'review' ||
    rawStatus === 'approved' ||
    rawStatus === 'archived'
      ? rawStatus
      : 'all';
  const projects =
    activeFilter === 'all'
      ? allProjects
      : allProjects.filter((p) => (p.status ?? 'draft') === activeFilter);

  // Contagem por status — exibida em cada pill do filtro
  const counts: Record<string, number> = { all: allProjects.length };
  for (const p of allProjects) {
    const s = p.status ?? 'draft';
    counts[s] = (counts[s] ?? 0) + 1;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meus projetos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length === 0
              ? activeFilter === 'all'
                ? 'Nenhum projeto ainda'
                : `Nenhum projeto com status "${activeFilter}"`
              : `${projects.length} projeto${projects.length === 1 ? '' : 's'}${activeFilter !== 'all' ? ` (${activeFilter})` : ''}`}
          </p>
        </div>
        <NewProjectButton />
      </div>

      {/* Filtro por status — pills clicáveis com contadores */}
      <div className="flex flex-wrap gap-1 mb-4">
        {STATUS_FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          const count = counts[f.key] ?? 0;
          const href = f.key === 'all' ? '/dashboard' : `/dashboard?status=${f.key}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-blip-purple text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
              <span className={`ml-0.5 text-[10px] ${isActive ? 'opacity-80' : 'text-gray-400'}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {projects.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <div className="text-5xl mb-3">📋</div>
          <h2 className="font-semibold text-gray-700">
            Crie seu primeiro projeto
          </h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Um projeto é um fluxo conversacional completo (1 chatbot, 1 cliente, etc.)
          </p>
          <NewProjectButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition group"
            >
              <Link href={`/editor/${project.id}`} className="block">
                <h3 className="font-semibold text-gray-900 group-hover:text-blip-purple">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-gray-400">
                  {/* Status badge — pill colorido */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      project.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : project.status === 'review'
                          ? 'bg-amber-100 text-amber-700'
                          : project.status === 'archived'
                            ? 'bg-gray-200 text-gray-500'
                            : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {project.status === 'approved'
                      ? '✓ Aprovado'
                      : project.status === 'review'
                        ? '👀 Em revisão'
                        : project.status === 'archived'
                          ? '📦 Arquivado'
                          : '✏️ Rascunho'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        project.visibility === 'public'
                          ? 'bg-green-500'
                          : project.visibility === 'org'
                          ? 'bg-blue-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    {project.visibility === 'public'
                      ? 'Público'
                      : project.visibility === 'org'
                      ? 'Organização'
                      : 'Privado'}
                  </span>
                  <span>·</span>
                  <span>
                    Atualizado {new Date(project.updated_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </Link>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/editor/${project.id}`}
                    className="text-xs font-medium text-blip-purple hover:underline"
                  >
                    Abrir editor →
                  </Link>
                  <Link
                    href={`/dashboard/audit/${project.id}`}
                    className="text-[11px] text-gray-400 hover:text-gray-700"
                    title="Histórico de ações (templates, shares, mudanças de status)"
                  >
                    📜 Histórico
                  </Link>
                  <Link
                    href={`/dashboard/ia-usage/${project.id}`}
                    className="text-[11px] text-gray-400 hover:text-gray-700"
                    title="Custo de uso da IA (tokens + USD por dia/feature)"
                  >
                    🤖 Uso IA
                  </Link>
                </div>
                <div className="flex items-center gap-1">
                  <EstimatedHoursInput
                    projectId={project.id}
                    initialHours={project.estimated_hours ?? null}
                  />
                  <DeleteProjectButton projectId={project.id} projectName={project.name} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
