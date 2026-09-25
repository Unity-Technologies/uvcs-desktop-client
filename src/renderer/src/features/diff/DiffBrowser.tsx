import { FileSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { SplitPane } from '../../ui/SplitPane';
import { FileDiffViewer } from './viewer/FileDiffViewer';
import { describeDiffEntry, diffEntrySources, diffEntryTone } from './diffEntrySources';
import { DiffEntryList, diffEntryKey } from './DiffEntryList';
import { diffEntryMenu } from './diffEntryMenu';

/** A list of changed files next to the diff of the selected one. */
export function DiffBrowser({ entries, initialPath }: { entries: DiffEntry[]; initialPath?: string }) {
  const workspacePath = useWorkspacePath();
  const [selection, setSelection] = useState<SelectionState>(() =>
    initialPath ? { selected: new Set([initialPath]), anchor: initialPath } : EMPTY_SELECTION,
  );
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
          contextMenu={(selected) => diffEntryMenu(workspacePath, selected)}
        />
      }
      second={focused ? <EntryDiff workspacePath={workspacePath} entry={focused} /> : null}
    />
  );
}

function EntryDiff({ workspacePath, entry }: { workspacePath: string; entry: DiffEntry }) {
  if (entry.itemType === 'directory') {
    return <EmptyState title={entry.path} description={`Directory · ${describeDiffEntry(entry)}`} />;
  }

  const { original, modified } = diffEntrySources(entry);
  return (
    <FileDiffViewer
      workspacePath={workspacePath}
      original={original}
      modified={modified}
      fileName={entry.path}
      title={
        <>
          <StatusBadge tone={diffEntryTone(entry)} title={describeDiffEntry(entry)} />
          <PathLabel path={entry.path} oldPath={entry.oldPath} />
        </>
      }
    />
  );
}
