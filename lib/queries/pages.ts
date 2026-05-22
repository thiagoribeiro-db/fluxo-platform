'use client';

/**
 * TanStack Query hooks pra páginas do projeto.
 *
 * Substitui os fetches raw com:
 *  - cache automático (staleTime 30s do default)
 *  - refetch ao focar window
 *  - retry em fail
 *  - mutations com invalidate
 *
 * Adotar PROGRESSIVAMENTE — code legado continua chamando listPages
 * direto, novo código usa o hook.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {
  createPage,
  deletePage,
  listPages,
  renamePage,
} from '@/lib/actions/pages';
import type { ProjectPage } from '@/lib/types';

// =============================================================================
// Query keys (centralizadas pra fácil invalidate)
// =============================================================================

export const pageKeys = {
  all: ['pages'] as const,
  list: (projectId: string) => [...pageKeys.all, 'list', projectId] as const,
};

// =============================================================================
// usePages — lista páginas do projeto
// =============================================================================

export function usePagesQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: pageKeys.list(projectId ?? ''),
    queryFn: () => listPages(projectId!),
    enabled: !!projectId,
  });
}

// =============================================================================
// Mutations
// =============================================================================

export function useCreatePageMutation(
  projectId: string,
  opts?: UseMutationOptions<ProjectPage, Error, string>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createPage(projectId, name),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.list(projectId) });
      opts?.onSuccess?.(...args);
    },
    ...opts,
  });
}

export function useRenamePageMutation(
  projectId: string,
  opts?: UseMutationOptions<void, Error, { pageId: string; name: string }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, name }) => renamePage(pageId, name),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.list(projectId) });
      opts?.onSuccess?.(...args);
    },
    ...opts,
  });
}

export function useDeletePageMutation(
  projectId: string,
  opts?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) => deletePage(pageId),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.list(projectId) });
      opts?.onSuccess?.(...args);
    },
    ...opts,
  });
}
