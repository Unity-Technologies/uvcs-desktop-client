import { Suspense, type ReactNode } from 'react';
import type { Place } from '@shared/domain/place';
import type { ContentSource } from '@shared/domain/content';
import { lazyComponent } from '../../../lib/lazyComponent';
import { useSpinDelay } from '../../../lib/useSpinDelay';
import { EmptyState } from '../../../ui/EmptyState';
import { CenteredSpinner } from '../../../ui/Spinner';
import { SteppedDiffFrame } from './SteppedDiffFrame';
import { useDiffContents } from './useDiffContents';
import { diffContentsKey } from './diffFrameHost';

// The viewers (Pierre, the image and 3D model viewers) load on first use: every view and page that shows a diff is in
// the startup bundle (`startupBundle.test.ts`). Meanwhile the frame shows as it does while the versions load.
const LoadedFileDiff = lazyComponent(() => import('./LoadedFileDiff').then((module) => module.LoadedFileDiff));

interface FileDiffViewerProps {
  /** Where the versions are read: a workspace, whose files it may edit, or a repository with none. */
  place: Place;
  original: ContentSource;
  modified: ContentSource;
  /** Used for syntax highlighting. */
  fileName: string;
  /** Shown at the left of the toolbar, e.g. the file path and its status. */
  title?: ReactNode;
  /** Explains why both versions are identical, e.g. "Moved without content changes". */
  identicalDescription?: string;
  /** Controls about what to compare, e.g. against the loaded revision or the reviewed copy. */
  compareControls?: ReactNode;
  /** Discarding changes brought the workspace file back to its loaded revision. */
  onMatchesBase?: () => void;
}

/**
 * Compares two versions of a file, choosing a text, image or binary presentation.
 * When the modified side is a file in the workspace, it can be edited in place.
 * Switching files keeps the previous diff on screen until the next one loads; a spinner
 * only shows up when loading is slow.
 */
export function FileDiffViewer({ place, original, modified, fileName, title, identicalDescription, compareControls, onMatchesBase }: FileDiffViewerProps) {
  const contents = useDiffContents(place, original, modified);
  const spin = useSpinDelay(contents.isPending || contents.isPlaceholderData);

  const requested = {
    key: diffContentsKey(original, modified),
    path: fileName,
    error: contents.error !== null,
    hasData: contents.data !== undefined,
    isPlaceholderData: contents.isPlaceholderData,
  };

  // One header for every file and state (`SteppedDiffFrame`): loading, failed or loaded, its arrows stay the same buttons.
  return (
    <SteppedDiffFrame title={title} requested={requested}>
      {body()}
    </SteppedDiffFrame>
  );

  function body(): ReactNode {
    if (contents.error) return <EmptyState title="Couldn't load this file" description={contents.error.message} />;
    if (spin || !contents.data) return spin && <CenteredSpinner />;
    return (
      <Suspense fallback={null}>
        <LoadedFileDiff
          // A new pair starts fresh: edits, blend and zoom belong to the file they were made on.
          key={diffContentsKey(contents.data.original, contents.data.modified)}
          place={place}
          contents={contents.data}
          fileName={fileName}
          identicalDescription={identicalDescription}
          compareControls={compareControls}
          onMatchesBase={onMatchesBase}
        />
      </Suspense>
    );
  }
}
