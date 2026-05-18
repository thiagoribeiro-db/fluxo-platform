import Link from 'next/link';
import FlowEditor from '@/components/editor/FlowEditor';
import { getSharedProject } from '@/lib/actions/shares';

export const dynamic = 'force-dynamic';

interface SharePageProps {
  params: { token: string };
}

/**
 * Página pública que abre um projeto compartilhado via share token.
 *
 * Não exige login. A permissão (view/comment/edit) define o que o usuário
 * pode fazer no FlowEditor — por enquanto só view-only.
 */
export default async function SharePage({ params }: SharePageProps) {
  const project = await getSharedProject(params.token);

  if (!project) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-gray-900">Link inválido ou expirado</h1>
          <p className="text-sm text-gray-500 mt-2">
            Esse link de compartilhamento não está mais ativo. Peça um novo ao
            criador do projeto.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 text-blip-purple font-medium hover:underline"
          >
            Ir para o início
          </Link>
        </div>
      </main>
    );
  }

  // Prefixo visual conforme permissão (sinaliza pro usuário em qual modo está)
  const prefix =
    project.permission === 'edit'
      ? '✏️'
      : project.permission === 'comment'
      ? '💬'
      : '👁';

  return (
    <FlowEditor
      projectId={project.id}
      projectName={`${prefix} ${project.name}`}
      initialState={project.state}
      shareMode={project.permission}
      shareToken={params.token}
    />
  );
}
