import { FileSearch } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useChangeFilter } from '../../components/useChangeFilter';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { SplitPane } from '../../ui/SplitPane';
import { diffEntryTone } from './diffEntrySources';
import { DiffEntryList, diffEntryKey } from './DiffEntryList';
import { diffEntryMenu } from './diffEntryMenu';
import { entryToFocus } from './diffFocus';
import { EntryDiff } from './EntryDiff';
import { listedEntries } from './listedEntries';
import { useDiffReview } from './review/useDiffReview';
import { FileStepsContext, useFileSteps } from './viewer/fileSteps';

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
    return initial ? singleSelection(diffEntryKey(initial)) : EMPTY_SELECTION;
  });
  const focused = entries.find((entry) => diffEntryKey(entry) === selection.anchor);
  const firstKey = entries[0] && diffEntryKey(entries[0]);
  const filter = useChangeFilter(entries, diffEntryKey, diffEntryTone, true);
  const rows = useMemo(() => review.narrow(filter.visible), [review.narrow, filter.visible]);
  // The diff's change navigation goes on to the files before and after, as the list shows them.
  const rowKeys = useMemo(() => rows.filter((entry) => entry.itemType !== 'directory').map(diffEntryKey), [rows]);
  const fileSteps = useFileSteps({ keys: rowKeys, current: selection.anchor, select: (key) => setSelection(singleSelection(key)), pathOf: (key) => key });

  useEffect(() => {
    if (!focused && firstKey) setSelection(singleSelection(firstKey));
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
          rows={rows}
          query={filter.query}
          filterBar={filter.bar}
          selection={selection}
          onSelectionChange={setSelection}
          contextMenu={(selected) => diffEntryMenu(workspacePath, target, selected, review)}
          review={review}
        />
      }
      second={
        focused ? (
          <FileStepsContext.Provider value={fileSteps}>
            <EntryDiff workspacePath={workspacePath} entry={focused} reviewMarks={review.marks} />
          </FileStepsContext.Provider>
        ) : null
      }
    />
  );
}
