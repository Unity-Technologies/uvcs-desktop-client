import { Ellipsis } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { TreeItem } from '@shared/domain/explorer';
import { goToFileKey } from '../../components/goToFileKeys';
import { GoToFileList } from '../../components/GoToFileList';
import { ItemPathRow } from '../../components/ItemPathRow';
import { runningFirst } from '../../lib/actions';
import { createFuzzyIndex, fuzzyMatchPositions } from '../../lib/fuzzyIndex';
import { isRowMenuKey } from '../../lib/rowMenu';
import { hotkey } from '../../lib/shortcutRegistry';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { KeyHints } from '../../ui/KeyHints';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { SearchField } from '../../ui/SearchField';
import { changeStatus } from '../pendingChanges/changeTone';
import { usePendingChanges } from '../pendingChanges/usePendingChanges';
import { readListedItem } from './directoryListing';
import { fileMenu } from './fileMenu';
import { itemDecoration } from './itemDecoration';
import { PendingChangesIndex } from './itemStatus';
import { useWorkspacePaths } from './useWorkspacePaths';
import styles from './GoToFileDialog.module.css';

const MAX_RESULTS = 60;

/** Asks for a file or folder by (fuzzy) name, starting from `initialQuery`. Resolves to its path, or undefined if dismissed. */
export function goToFile(workspacePath: string, initialQuery = ''): Promise<string | undefined> {
  return askDialog<string>((finish) => <GoToFileDialog workspacePath={workspacePath} initialQuery={initialQuery} finish={finish} />);
}

interface GoToFileDialogProps {
  workspacePath: string;
  initialQuery: string;
  finish: (path: string | undefined) => void;
}

function GoToFileDialog({ workspacePath, initialQuery, finish }: GoToFileDialogProps) {
  const [query, setQuery] = useState(initialQuery);
  const [highlighted, setHighlighted] = useState(0);
  /** The result whose actions are open (Tab), once its item is read. */
  const [actionsFor, setActionsFor] = useState<TreeItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: entries, isLoading } = useWorkspacePaths(workspacePath);
  const { data: pendingChanges } = usePendingChanges();

  const directories = useMemo(() => new Set(entries?.filter((entry) => entry.isDirectory).map((entry) => entry.path)), [entries]);
  const pendingIndex = useMemo(() => new PendingChangesIndex(pendingChanges?.changes ?? []), [pendingChanges]);
  const allPaths = useMemo(() => entries?.map((entry) => entry.path) ?? [], [entries]);
  const index = useMemo(() => createFuzzyIndex(allPaths), [allPaths]);
  const results = useMemo(() => index.rank(query, MAX_RESULTS).map((position) => allPaths[position]!), [index, allPaths, query]);

  // The file menu needs the item's version control details: its folder's listing has them (and the Files view may have read it).
  const openActions = async (path: string): Promise<void> => {
    setActionsFor((await readListedItem(workspacePath, path)) ?? null);
  };
  const actions = (item: TreeItem) =>
    runningFirst(fileMenu(workspacePath, [item], pendingIndex), () => finish(undefined));

  const onKeyDown = (event: KeyboardEvent): void => {
    const key = goToFileKey(event.key, highlighted, results.length);
    if (key) {
      event.preventDefault();
      if (key.kind === 'highlight') setHighlighted(key.index);
      else finish(results[key.index]);
    } else if (isRowMenuKey(event) && results[highlighted]) {
      event.preventDefault();
      void openActions(results[highlighted]);
    }
  };

  return (
    <Dialog title="Go to file" width={620} onClose={() => finish(undefined)}>
      <div onKeyDown={onKeyDown}>
        <SearchField
          ref={inputRef}
          value={query}
          onChange={(value) => {
            setQuery(value);
            setHighlighted(0);
          }}
          placeholder="Fuzzy search files and folders"
          autoFocus
          width={570}
        />
      </div>
      <GoToFileList
        paths={results}
        highlighted={highlighted}
        onHighlight={setHighlighted}
        onPick={finish}
        loading={isLoading}
        note={!isLoading && results.length === 0 ? `No files match “${query}”.` : null}
        row={(path) => <ResultRow path={path} isDirectory={directories.has(path)} matches={fuzzyMatchPositions(path, query)} pendingIndex={pendingIndex} />}
        highlightedExtra={(path) => (
          <ActionDropdownMenu
            entries={actionsFor?.path === path ? actions(actionsFor) : []}
            open={actionsFor?.path === path}
            onOpenChange={(open) => (open ? void openActions(path) : setActionsFor(null))}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <button type="button" tabIndex={-1} className={styles.actions} aria-label="Actions" data-tip="Actions" data-tip-shortcut={hotkey('rowActions')}>
              <Ellipsis size={15} />
            </button>
          </ActionDropdownMenu>
        )}
      />
      <KeyHints hints={[{ keys: hotkey('rowActions'), label: 'actions' }]} />
    </Dialog>
  );
}

/** A result as the Files tree shows its item: icon, path, status letter. */
function ResultRow({ path, isDirectory, matches, pendingIndex }: { path: string; isDirectory: boolean; matches: number[]; pendingIndex: PendingChangesIndex }) {
  const change = pendingIndex.changeAt(path);
  const { status, presence } = itemDecoration({ isPrivate: false }, change ? changeStatus(change) : null);
  return (
    <ItemPathRow
      path={path}
      itemType={isDirectory ? 'directory' : 'file'}
      matches={matches}
      status={status}
      changesInside={isDirectory && pendingIndex.hasChangesInside(path)}
      presence={presence}
    />
  );
}
