import { redirect } from 'next/navigation';
import Link from 'next/link';
import FlowEditor from '@/components/editor/FlowEditor';
import { createClient } from '@/lib/supabase/server';
import { getProjectWithPages } from '@/lib/actions/projects';

interface EditorPageProps {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export default async function EditorPage({ params }: EditorPageProps) {
  // /editor/demo continua funcionando sem auth (canvas com seed local)
  if (params.id === 'demo') {
    return <FlowEditor projectId="demo" />;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/editor/${params.id}`);

  const result = await getProjectWithPages(params.id);
  if (!result) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-3">🤷</div>
          <h1 className="text-xl font-bold text-gray-900">Projeto não encontrado</h1>
          <p className="text-sm text-gray-500 mt-1">
            Talvez tenha sido deletado ou você não tem acesso.
          </p>
          <Link
            href="/dashboard"
            className="inline-block mt-4 text-blip-purple font-medium hover:underline"
          >
            ← Voltar para meus projetos
          </Link>
        </div>
      </main>
    );
  }

  const { project, pages, activePageId } = result;
  const activePage =
    pages.find((p) => p.id === activePageId) ?? pages[0] ?? null;

  // Busca display_name do profile pra avatar de presence (cai pro email)
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  return (
    <FlowEditor
      projectId={project.id}
      projectName={project.name}
      initialStatus={project.status ?? 'draft'}
      initialState={activePage?.state ?? project.state}
      pages={pages}
      activePageId={activePage?.id ?? null}
      currentUser={{
        id: user.id,
        email: user.email,
        name: profile?.display_name ?? user.email?.split('@')[0],
      }}
    />
  );
}
