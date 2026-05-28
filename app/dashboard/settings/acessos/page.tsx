import { notFound } from 'next/navigation';
import AccessManagement from '../AccessManagement';
import { listPlatformUsers } from '@/lib/actions/access';
import { getMyProfile, hasMinRole } from '@/lib/auth/roles';

/**
 * Sub-rota /dashboard/settings/acessos — Gerenciamento de Acessos.
 *
 * Só Admin+ pode acessar. Editor cai em 404 (ou redirect via middleware se
 * preferir, mas notFound é mais conservador — não vaza existência da rota).
 */
export default async function AcessosPage() {
  const me = await getMyProfile();
  const role = me?.platform_role ?? 'editor';
  if (!hasMinRole(role, 'admin')) notFound();

  const users = await listPlatformUsers();
  return <AccessManagement users={users} myRole={role} myId={me!.id} />;
}
