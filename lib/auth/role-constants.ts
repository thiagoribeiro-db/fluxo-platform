/**
 * Tipos e constantes de platform_role — sem imports server-only.
 * Pode ser importado por Client Components com segurança.
 */

export type PlatformRole = 'editor' | 'admin' | 'superAdmin';

export const ROLE_LABELS: Record<PlatformRole, string> = {
  editor: 'Edição',
  admin: 'Admin',
  superAdmin: 'Super Admin',
};

/** Tabs visíveis por role */
export const ROLE_TABS: Record<
  PlatformRole,
  Array<{ href: string; label: string; icon: string }>
> = {
  editor: [{ href: '/dashboard', label: 'Projetos', icon: '📋' }],
  admin: [
    { href: '/dashboard', label: 'Projetos', icon: '📋' },
    { href: '/dashboard/components', label: 'Componentes', icon: '🧩' },
    { href: '/dashboard/settings', label: 'Configurações', icon: '⚙️' },
  ],
  superAdmin: [
    { href: '/dashboard', label: 'Projetos', icon: '📋' },
    { href: '/dashboard/components', label: 'Componentes', icon: '🧩' },
    { href: '/dashboard/settings', label: 'Configurações', icon: '⚙️' },
  ],
};

/**
 * Verifica se o role atual tem permissão mínima.
 * Hierarquia: editor < admin < superAdmin
 */
export function hasMinRole(current: PlatformRole, required: PlatformRole): boolean {
  const order: PlatformRole[] = ['editor', 'admin', 'superAdmin'];
  return order.indexOf(current) >= order.indexOf(required);
}
