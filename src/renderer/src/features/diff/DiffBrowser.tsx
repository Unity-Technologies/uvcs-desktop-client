import { FileSearch } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { SplitPane } from '../../ui/SplitPane';
import { SinceReviewButton } from '../review/SinceReviewButton';
import { DiffFileTitle } from './viewer/DiffFileTitle';
import { FileDiffViewer } from './viewer/FileDiffViewer';
import { ONLY_MOVED } from './viewer/movedFrom';
import { describeDiffEntry, diffEntrySources, diffEntryTone } from './diffEntrySources';
import { DiffEntryList, diffEntryKey } from './DiffEntryList';
import { diffEntryMenu } from './diffEntryMenu';
import { entryToFocus } from './diffFocus';
import { listedEntries } from './listedEntries';
import { reviewedRevisionToCompare, type DiffReviewMarks } from './review/diffReview';
import { useDiffReview } from './review/useDiffReview';

interface DiffBrowserProps {
  target: DiffTarget;
  entries: DiffEntry[];
  /** The file to open on (by its path, or its old path for a move); the first file when it isn't in the diff. */
  initialPath?: string;
}

/** A list of changed files next to the diff of the selected one. */
export function DiffBrowser({ target, entries: diffEntries, initialPath }: DiffBrowserProps) {
  const workspacePath = useWorkspacePath();
  const entries = useMemo(() => listedEntries(diffEntries), [diffEntries]);
  const review = useDiffReview(target, entries);
  const [selection, setSelection] = useState<SelectionState>(() => {
    const initial = entryToFocus(entries, initialPath);
    return initial ? { selected: new Set([diffEntryKey(initial)]), anchor: diffEntryKey(initial) } : EMPTY_SELECTION;
  });
  const focused = entries.find((entry) => diffEntryKey(entry) === selection.anchor);
  const firstKey = entries[0] && diffEntryKey(entries[0]);

  useEffect(() => {
    if (!focused && firstKey) setSelection({ selected: new Set([firstKey]), anchor: firstKey });
  }, [focused, firstKey]);

  if (entries.length === 0) {
    return <EmptyState icon={<FileSearch size={22} />} title="No differences" description="There are no file changes to show." />;
  }

  return (
    <SplitPane
      initialSize={340}
      minSize={220}
      maxSize={640}
      first={
        <DiffEntryList
          entries={entries}
          selection={selection}
          onSelectionChange={setSelection}
          contextMenu={(selected) => diffEntryMenu(workspacePath, target, selected, review)}
          review={review}
        />
      }
      second={focused ? <EntryDiff workspacePath={workspacePath} entry={focused} reviewMarks={review.marks} /> : null}
    />
  );
}

function EntryDiff({ workspacePath, entry, reviewMarks }: { workspacePath: string; entry: DiffEntry; reviewMarks: DiffReviewMarks }) {
  // Per file: "Since review" is a way to look at one file, not a mode that follows the selection.
  const [sinceReviewPath, setSinceReviewPath] = useState<string | null>(null);

  if (entry.itemType === 'directory') {
    return <EmptyState title={entry.path} description={`Directory · ${describeDiffEntry(entry)}`} />;
  }

  const reviewedRevision = reviewedRevisionToCompare(reviewMarks, entry);
  const sinceReview = reviewedRevision !== null && sinceReviewPath === entry.path;
  const sources = diffEntrySources(entry);
  return (
    <FileDiffViewer
      workspacePath={workspacePath}
      original={sinceReview ? { kind: 'revision', revisionId: reviewedRevision, fileName: entry.path } : sources.original}
      modified={sources.modified}
      fileName={entry.path}
      title={<DiffFileTitle tone={diffEntryTone(entry)} status={describeDiffEntry(entry)} path={entry.path} oldPath={entry.oldPath} />}
      identicalDescription={sinceReview ? 'The file is back to how it was when you reviewed it.' : entry.oldPath ? ONLY_MOVED : undefined}
      compareControls={
        reviewedRevision !== null && <SinceReviewButton pressed={sinceReview} onChange={(pressed) => setSinceReviewPath(pressed ? entry.path : null)} />
      }
    />
  );
}
