import type { ReactNode } from 'react';
import type { ContentSource } from '@shared/domain/content';
import { useSpinDelay } from '../../../lib/useSpinDelay';
import { EmptyState } from '../../../ui/EmptyState';
import { CenteredSpinner } from '../../../ui/Spinner';
import { DiffViewerFrame } from './DiffViewerFrame';
import { LoadedFileDiff } from './LoadedFileDiff';
import { useDiffContents, type DiffContents } from './useDiffContents';

interface FileDiffViewerProps {
  workspacePath: string;
  original: ContentSource;
  modified: ContentSource;
  /** Used for syntax highlighting. */
  fileName: string;
  /** Shown at the left of the toolbar, e.g. the file path and its status. */
  title?: ReactNode;
  /** Explains why both versions are identical, e.g. "Moved without content changes". */
  identicalDescription?: string;
}

/**
 * Compares two versions of a file, choosing a text, image or binary presentation.
 * When the modified side is a file in the workspace, it can be edited in place.
 * Switching files keeps the previous diff on screen until the next one loads; a spinner
 * only shows up when loading is slow.
 */
export function FileDiffViewer({ workspacePath, original, modified, fileName, title, identicalDescription }: FileDiffViewerProps) {
  const contents = useDiffContents(workspacePath, original, modified);
  const spin = useSpinDelay(contents.isPending || contents.isPlaceholderData);

  if (contents.error) {
    return (
      <DiffViewerFrame title={title}>
        <EmptyState title="Couldn't load this file" description={contents.error.message} />
      </DiffViewerFrame>
    );
  }
  if (spin || !contents.data) {
    return <DiffViewerFrame title={title}>{spin && <CenteredSpinner />}</DiffViewerFrame>;
  }
  return (
    <LoadedFileDiff
      // A new pair starts fresh: edits, blend and zoom belong to the file they were made on.
      key={pairKey(contents.data)}
      workspacePath={workspacePath}
      contents={contents.data}
      fileName={fileName}
      title={title}
      identicalDescription={identicalDescription}
    />
  );
}

function pairKey({ original, modified }: DiffContents): string {
  return JSON.stringify([original, modified]);
}
