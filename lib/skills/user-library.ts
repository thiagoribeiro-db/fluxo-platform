/**
 * Biblioteca de skills customizadas do usuário — persistência local.
 *
 * Cada skill é um snapshot de N nodes + edges salvos com nome próprio.
 * Quando o user seleciona blocos no canvas e escolhe "Salvar como skill",
 * o sistema serializa pra cá. Depois, no SkillsDialog, aparece numa seção
 * "Minha biblioteca" ao lado dos builtins.
 *
 * Storage: localStorage (escopo USUÁRIO — não compartilha entre membros
 * da mesma org). Migração futura pra DB sem mudar a API.
 */

import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';

const STORAGE_KEY = 'fluxo:user-skills:v1';

export interface UserSkill {
  id: string;
  name: string;
  description: string;
  emoji: string;
  /** Nodes serializados — sem os IDs originais, regerados ao inserir. */
  nodes: FluxoNode[];
  /** Edges entre os nodes salvos. */
  edges: Edge[];
  createdAt: number;
  updatedAt: number;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function listUserSkills(): UserSkill[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is UserSkill =>
          typeof s?.id === 'string' &&
          typeof s?.name === 'string' &&
          Array.isArray(s?.nodes) &&
          Array.isArray(s?.edges)
      )
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [];
  }
}

function persistList(list: UserSkill[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export interface CreateUserSkillInput {
  name: string;
  description?: string;
  emoji?: string;
  nodes: FluxoNode[];
  edges: Edge[];
}

export function createUserSkill(input: CreateUserSkillInput): UserSkill {
  const list = listUserSkills();
  const now = Date.now();
  const skill: UserSkill = {
    id: newId(),
    name: input.name.trim() || 'Skill sem nome',
    description: input.description?.trim() ?? '',
    emoji: input.emoji?.trim() || '🧩',
    nodes: input.nodes,
    edges: input.edges,
    createdAt: now,
    updatedAt: now,
  };
  list.unshift(skill);
  persistList(list);
  return skill;
}

export function deleteUserSkill(id: string): boolean {
  const list = listUserSkills();
  const filtered = list.filter((s) => s.id !== id);
  if (filtered.length === list.length) return false;
  persistList(filtered);
  return true;
}

export function getUserSkill(id: string): UserSkill | null {
  return listUserSkills().find((s) => s.id === id) ?? null;
}

/**
 * Extrai um subgrafo a partir de IDs selecionados — recolhe os nodes,
 * children (parentId aponta pra um selecionado) e edges internas.
 *
 * Usado pelo handler "Salvar seleção como skill" antes de persistir.
 */
export function extractSubgraph(
  allNodes: FluxoNode[],
  allEdges: Edge[],
  selectedIds: string[]
): { nodes: FluxoNode[]; edges: Edge[] } {
  const includedIds = new Set(selectedIds);

  // Pega children (parentId em selecionados)
  for (const n of allNodes) {
    if (n.parentId && includedIds.has(n.parentId)) includedIds.add(n.id);
  }

  // Coleta nodes na ordem original
  const nodes = allNodes.filter((n) => includedIds.has(n.id));
  // Edges com ambos endpoints no grupo
  const edges = allEdges.filter(
    (e) => includedIds.has(e.source) && includedIds.has(e.target)
  );

  return { nodes, edges };
}
