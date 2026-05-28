/**
 * Config das seções da página de Configurações.
 *
 * Compartilhado entre Sidebar (client) e layout/page (server). Por isso fica
 * sem 'use client' — apenas dados + helper de filtragem.
 */

import { Users, Sparkles, Bot, type LucideIcon } from 'lucide-react';
import { hasMinRole, type PlatformRole } from '@/lib/auth/role-constants';

export interface SettingsSection {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  minRole?: PlatformRole;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    href: '/dashboard/settings/acessos',
    label: 'Gerenciamento de Acessos',
    description: 'Lista de usuários, perfis e permissões',
    icon: Users,
    minRole: 'admin',
  },
  {
    href: '/dashboard/settings/voice-tone',
    label: 'Voice & Tone padrão',
    description: 'Perfil de voz aplicado em projetos novos',
    icon: Sparkles,
  },
  {
    href: '/dashboard/settings/parser-ia',
    label: 'Parser IA',
    description: 'System prompt enviado ao Claude no parse de escopos',
    icon: Bot,
  },
];

/** Filtra seções acessíveis pelo `platform_role` do user. */
export function getVisibleSections(role: PlatformRole): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((s) => !s.minRole || hasMinRole(role, s.minRole));
}
