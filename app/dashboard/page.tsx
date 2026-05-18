import Link from 'next/link';
import { listProjects } from '@/lib/actions/projects';
import NewProjectButton from './NewProjectButton';
import DeleteProjectButton from './DeleteProjectButton';

export const dynamic = 'force-dynamic';

/**
 * Aba PROJETOS da dashboard. Topbar e nav vivem em `layout.tsx`.
 */
export default async function DashboardProjetosPage() {
  const projects = await listProjects();

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meus projetos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length === 0
              ? 'Nenhum projeto ainda'
              : `${projects.length} projeto${projects.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <NewProjectButton />
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
                <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
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
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <Link
                  href={`/editor/${project.id}`}
                  className="text-xs font-medium text-blip-purple hover:underline"
                >
                  Abrir editor →
                </Link>
                <DeleteProjectButton projectId={project.id} projectName={project.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
