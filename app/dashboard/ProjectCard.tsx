'use client';

import { useState } from 'react';
import Link from 'next/link';
import ShareByEmailDialog from '@/components/dashboard/ShareByEmailDialog';
import DeleteProjectButton from './DeleteProjectButton';
import EstimatedHoursInput from './EstimatedHoursInput';
import type { ProjectCollaborator } from '@/lib/actions/project-collaborators';
import type { Project } from '@/lib/types';

interface Props {
  project: Project;
  collaborators: ProjectCollaborator[];
  isOwner: boolean;
}

function getStatusStyle(status?: string) {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (status === 'review') return 'bg-amber-100 text-amber-700';
  if (status === 'archived') return 'bg-gray-200 text-gray-500';
  return 'bg-slate-100 text-slate-600';
}

function getStatusLabel(status?: string) {
  if (status === 'approved') return '✓ Aprovado';
  if (status === 'review') return '👀 Em revisão';
  if (status === 'archived') return '📦 Arquivado';
  return '✏️ Rascunho';
}

/**
 * Card de projeto no dashboard.
 * Contém o botão de compartilhar por e-mail com outros usuários da plataforma.
 */
export default function ProjectCard({ project, collaborators, isOwner }: Props) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition group">
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
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStatusStyle(project.status)}`}
            >
              {getStatusLabel(project.status)}
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
            {collaborators.length > 0 && (
              <>
                <span>·</span>
                <span className="text-blip-purple">
                  👥 {collaborators.length} pessoa{collaborators.length > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </Link>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/editor/${project.id}`}
              className="text-xs font-medium text-blip-purple hover:underline"
            >
              Abrir editor →
            </Link>
            <Link
              href={`/dashboard/audit/${project.id}`}
              className="text-[11px] text-gray-400 hover:text-gray-700"
              title="Histórico de ações"
            >
              📜 Histórico
            </Link>
            <Link
              href={`/dashboard/ia-usage/${project.id}`}
              className="text-[11px] text-gray-400 hover:text-gray-700"
              title="Custo de uso da IA"
            >
              🤖 Uso IA
            </Link>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <EstimatedHoursInput
              projectId={project.id}
              initialHours={project.estimated_hours ?? null}
            />
            {/* Botão compartilhar */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                title="Compartilhar com outro usuário da plataforma"
                className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-blip-purple border border-gray-200 hover:border-blip-purple/30 rounded-md px-2 py-1 transition-colors shrink-0"
              >
                🔗
              </button>
            )}
            <DeleteProjectButton projectId={project.id} projectName={project.name} />
          </div>
        </div>
      </div>

      <ShareByEmailDialog
        projectId={project.id}
        projectName={project.name}
        collaborators={collaborators}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}
