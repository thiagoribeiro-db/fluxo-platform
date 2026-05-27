import { listProjects } from '@/lib/actions/projects';
import { listProjectCollaborators } from '@/lib/actions/project-collaborators';
import { getMyProfile } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';
import NewProjectButton from './NewProjectButton';
import DeleteProjectButton from './DeleteProjectButton';
import EstimatedHoursInput from './EstimatedHoursInput';
import ProjectCard from './ProjectCard';
import Link from 'next/link';
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
 * Aba PROJETOS da dashboard.
 * - editor/admin: projetos do próprio usuário + compartilhados
 * - superAdmin: todos os projetos da plataforma
 */
export default async function DashboardProjetosPage({ searchParams }: PageProps) {
  const me = await getMyProfile();
  const isSuperAdmin = me?.platform_role === 'superAdmin';

  const allProjects = await listProjects();

  // Filtra por status
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

  // Contagem por status
  const counts: Record<string, number> = { all: allProjects.length };
  for (const p of allProjects) {
    const s = p.status ?? 'draft';
    counts[s] = (counts[s] ?? 0) + 1;
  }

  // Busca colaboradores de todos os projetos em paralelo
  const collaboratorsMap: Record<string, Awaited<ReturnType<typeof listProjectCollaborators>>> = {};
  await Promise.all(
    allProjects.map(async (p) => {
      collaboratorsMap[p.id] = await listProjectCollaborators(p.id);
    })
  );

  const myId = me?.id ?? '';
  const pageTitle = isSuperAdmin ? 'Todos os projetos' : 'Meus projetos';

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length === 0
              ? activeFilter === 'all'
                ? 'Nenhum projeto ainda'
                : `Nenhum projeto com status "${activeFilter}"`
              : `${projects.length} projeto${projects.length === 1 ? '' : 's'}${activeFilter !== 'all' ? ` (${activeFilter})` : ''}${isSuperAdmin ? ' (todos os usuários)' : ''}`}
          </p>
        </div>
        <NewProjectButton />
      </div>

      {/* Filtro por status */}
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
          {projects.map((project) => {
            const isOwner = project.created_by === myId;
            const collabs = collaboratorsMap[project.id] ?? [];
            return (
              <div key={project.id} className="relative">
                {/* Tag "Compartilhado" para projetos que não são do usuário */}
                {!isOwner && !isSuperAdmin && (
                  <div className="absolute -top-2 left-4 z-10">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-blip-purple text-white rounded-full px-2 py-0.5">
                      🔗 Compartilhado
                    </span>
                  </div>
                )}
                {isSuperAdmin && !isOwner && (
                  <div className="absolute -top-2 left-4 z-10">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-gray-700 text-white rounded-full px-2 py-0.5">
                      👁 Outro usuário
                    </span>
                  </div>
                )}
                <ProjectCard
                  project={project}
                  collaborators={collabs}
                  isOwner={isOwner || isSuperAdmin}
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
