import { useQuery } from '@tanstack/react-query';
import type { ReleaseNotes, UpdateStatus } from '@shared/domain/appUpdate';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { plainText, type MarkdownBlock, type MarkdownInline } from '../../lib/markdown';
import { releaseNotesFromHtml } from '../../lib/releaseNotesHtml';
import { IMMUTABLE_QUERY } from '../queryClient';
import { useUpdateStore } from './updateStore';

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
  /** Where GitHub's generated notes link every change since the previous release, shown as a quiet line after them. */
  changelogUrl: string | null;
}

/**
 * What the What's New dialog shows: each release's notes, newest first. GitHub's generated notes open with a "What's
 * Changed" heading, which the dialog's title already says, and close with a "Full Changelog" link, which reads as a
 * footnote: the one is left out, the other set apart (`changelogUrl`).
 */
export function releaseNotesSections(notes: readonly ReleaseNotes[]): ReleaseNotesSection[] {
  return notes.map(({ version, html }) => {
    const blocks = withoutWhatsChangedHeading(releaseNotesFromHtml(html));
    const changelogUrl = changelogUrlOf(blocks.at(-1));
    return {
      version,
      heading: notes.length > 1 ? `Version ${version}` : null,
      blocks: changelogUrl ? blocks.slice(0, -1) : blocks,
      changelogUrl,
    };
  });
}

const WHATS_CHANGED = /^what[’']s changed$/i;
const FULL_CHANGELOG = /^full changelog\b/i;

function withoutWhatsChangedHeading(blocks: MarkdownBlock[]): MarkdownBlock[] {
  const [first] = blocks;
  return first?.kind === 'heading' && WHATS_CHANGED.test(plainText(first.children).trim()) ? blocks.slice(1) : blocks;
}

/** The link of a closing "**Full Changelog**: <link>" paragraph, as GitHub generates it. */
function changelogUrlOf(block: MarkdownBlock | undefined): string | null {
  if (block?.kind !== 'paragraph' || !FULL_CHANGELOG.test(plainText(block.children))) return null;
  const links = block.children.filter((inline): inline is Extract<MarkdownInline, { kind: 'link' }> => inline.kind === 'link');
  return links.length === 1 ? links[0]!.url : null;
}
