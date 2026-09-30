import { useQuery } from '@tanstack/react-query';
import type { ReleaseNotes, UpdateStatus } from '@shared/domain/appUpdate';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import type { MarkdownBlock } from '../../lib/markdown';
import { releaseNotesFromHtml } from '../../lib/releaseNotesHtml';
import { IMMUTABLE_QUERY } from '../queryClient';
import { useUpdateStore } from './updateStore';

/** The version of the update found, downloading or ready to install; none otherwise. */
export function foundUpdateVersion(status: UpdateStatus): string | null {
  return status.state === 'downloading' || status.state === 'ready' ? status.version : null;
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
export function useUpdateReleaseNotes(): ReleaseNotes[] {
  const version = useUpdateStore((state) => foundUpdateVersion(state.status));
  const { data } = useQuery({ ...releaseNotesQuery(version ?? ''), enabled: version !== null });
  return version !== null && data ? data : [];
}

export interface ReleaseNotesSection {
  version: string;
  /** Names the release when the update spans several; one release needs no heading under the dialog's title. */
  heading: string | null;
  blocks: MarkdownBlock[];
}

/** What the What's New dialog shows: each release's notes, newest first. */
export function releaseNotesSections(notes: readonly ReleaseNotes[]): ReleaseNotesSection[] {
  return notes.map(({ version, html }) => ({
    version,
    heading: notes.length > 1 ? `Version ${version}` : null,
    blocks: releaseNotesFromHtml(html),
  }));
}
