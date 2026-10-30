import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ReleaseNotes, UpdateStatus } from '@shared/domain/appUpdate';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../queryClient';
import { useUpdateStore } from './updateStore';
import { whatsNewRelease } from './whatsNewRelease';
import { hasWhatsNew } from './whatsNewView';

/** The version of the update found, downloading or ready to install; none otherwise. */
export function foundUpdateVersion(status: UpdateStatus): string | null {
  return status.state === 'downloading' || status.state === 'ready' || status.state === 'waitingToInstall' ? status.version : null;
}

/** The notes of the update found, read once per version: main has them from the check that found it (`AppUpdates`). */
export function releaseNotesQuery(version: string) {
  return {
    queryKey: queryKeys.releaseNotes(version),
    queryFn: () => api.updates.releaseNotes(),
    staleTime: Infinity,
    meta: IMMUTABLE_QUERY,
  };
}

/** The notes of the update found, empty while none is found or its releases have none. */
function useUpdateReleaseNotes(): ReleaseNotes[] {
  const version = useUpdateStore((state) => foundUpdateVersion(state.status));
  const { data } = useQuery({ ...releaseNotesQuery(version ?? ''), enabled: version !== null });
  return version !== null && data ? data : [];
}

/** Whether the update found has anything for What's New to show (`hasWhatsNew`), so it's offered only then. */
export function useHasWhatsNew(): boolean {
  const notes = useUpdateReleaseNotes();
  return useMemo(() => hasWhatsNew(notes.map(whatsNewRelease)), [notes]);
}
