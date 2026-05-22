'use client';

/**
 * TanStack Query hooks pra page_versions (histórico de snapshots).
 *
 * VersionsPanel pode migrar pra esses hooks pra ganhar cache + invalidate
 * automático em create/restore/delete.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createVersion,
  deleteVersion,
  listVersions,
  restoreVersion,
} from '@/lib/actions/page-versions';

export const versionKeys = {
  all: ['versions'] as const,
  list: (pageId: string) => [...versionKeys.all, 'list', pageId] as const,
};

export function useVersionsQuery(pageId: string | undefined) {
  return useQuery({
    queryKey: versionKeys.list(pageId ?? ''),
    queryFn: () => listVersions(pageId!),
    enabled: !!pageId,
    staleTime: 10_000, // versões mudam menos
  });
}

export function useCreateVersionMutation(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label?: string) => createVersion(pageId, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versionKeys.list(pageId) });
    },
  });
}

export function useRestoreVersionMutation(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => restoreVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versionKeys.list(pageId) });
    },
  });
}

export function useDeleteVersionMutation(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => deleteVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versionKeys.list(pageId) });
    },
  });
}
