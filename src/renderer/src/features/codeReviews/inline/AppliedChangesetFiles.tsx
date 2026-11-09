import { createContext, useContext, useEffect, useMemo } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { EmptyState } from '../../../ui/EmptyState';
import { CenteredSpinner } from '../../../ui/Spinner';
import { DiffBrowser } from '../../diff/DiffBrowser';
import { DiffBrowserLayout } from '../../diff/DiffBrowserLayout';
import { EntryAnnotatorContext, type EntryAnnotatorProps } from '../../diff/entryAnnotator';
import { EntryFlagContext } from '../../diff/entryFlag';
import { DiffAnnotationsContext } from '../../diff/viewer/diffAnnotations';
import { commentedFileFlag, isCommentedEntry } from './appliedFiles';
import { anchorPath } from './fileThreads';
import type { ViewProps } from './CommentContextDialog';
import { useContextComparison } from './useContextComparison';
import { useThreadRow } from './useThreadRow';

type AppliedFilesProps = ViewProps & {
  /** Says whether the commented file is the one shown: the dialog's header then offers its two views. */
  onCommentShown: (shown: boolean) => void;
  /** The changeset that applied the thread, and its files. */
  target: DiffTarget;
  entries: readonly DiffEntry[];
};

/** The thread and its views, for the commented file's diff among the changeset's (`CommentedFile`). */
const CommentInFiles = createContext<AppliedFilesProps | null>(null);

/**
 * The files of the changeset that applied a change request, as its diff lists them (filter, change types, tree or
 * list: `DiffBrowser`), the commented one selected first. That file's diff is the comment's, with its two views; the
 * others are as the changeset changed them.
 */
export function AppliedChangesetFiles(props: AppliedFilesProps) {
  const { target, entries, thread } = props;
  // `DiffBrowser` takes the diff's own array.
  const listed = useMemo(() => [...entries], [entries]);
  const flag = useMemo(() => commentedFileFlag(thread), [thread]);
  return (
    <CommentInFiles.Provider value={props}>
      <EntryAnnotatorContext.Provider value={CommentedFile}>
        <EntryFlagContext.Provider value={flag}>
          <DiffBrowserLayout expandable={false}>
            {(slots) => <DiffBrowser target={target} entries={listed} initialPath={anchorPath(thread.root.anchor)} slots={slots} publishes={false} />}
          </DiffBrowserLayout>
        </EntryFlagContext.Provider>
      </EntryAnnotatorContext.Provider>
    </CommentInFiles.Provider>
  );
}

/** Each file's diff of the changeset: the commented one shows the comment's view of it (the header's switch picks which). */
function CommentedFile({ entry, children }: EntryAnnotatorProps) {
  const props = useContext(CommentInFiles);
  if (!props || !isCommentedEntry(entry, props.thread)) return children({});
  return <CommentView {...props}>{children}</CommentView>;
}

function CommentView({ children, ...props }: AppliedFilesProps & Pick<EntryAnnotatorProps, 'children'>) {
  const { onCommentShown } = props;
  useEffect(() => {
    onCommentShown(true);
    return () => onCommentShown(false);
  }, [onCommentShown]);
  const state = useContextComparison(props);
  const comparison = state.kind === 'comparison' ? state.comparison : null;
  const annotations = useThreadRow({ ...props, comparison });
  if (state.kind === 'reading') return <CenteredSpinner />;
  if (state.kind === 'error') return <EmptyState title="Couldn't load this diff" description={state.message} />;
  if (state.kind === 'missing' || !comparison || !annotations) return <EmptyState title={state.kind === 'missing' ? state.text : ''} />;
  return (
    <DiffAnnotationsContext.Provider key={props.view} value={annotations}>
      {children({ compared: { original: comparison.original, modified: comparison.modified } })}
    </DiffAnnotationsContext.Provider>
  );
}
