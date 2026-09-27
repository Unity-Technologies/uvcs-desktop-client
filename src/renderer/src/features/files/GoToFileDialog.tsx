import { Ellipsis, File, Folder } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { TreeItem } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { PathLabel } from '../../components/PathLabel';
import { runningFirst } from '../../lib/actions';
import { createFuzzyIndex, fuzzyMatchPositions } from '../../lib/fuzzyIndex';
import { parentDirectory } from '../../lib/paths';
import { isRowMenuKey } from '../../lib/rowMenu';
import { hotkey } from '../../lib/shortcutRegistry';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { KeyHints } from '../../ui/KeyHints';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { usePendingChanges } from '../pendingChanges/usePendingChanges';
import { fileMenu } from './fileMenu';
import { PendingChangesIndex } from './itemStatus';
import { useWorkspacePaths } from './useWorkspacePaths';
import styles from './GoToFileDialog.module.css';

const MAX_RESULTS = 60;

/** Asks for a file or folder by (fuzzy) name, starting from `initialQuery`. Resolves to its path, or undefined if dismissed. */
export function goToFile(workspacePath: string, initialQuery = ''): Promise<string | undefined> {
  return askDialog<string>((finish) => <GoToFileDialog workspacePath={workspacePath} initialQuery={initialQuery} finish={finish} />);
}

/** The listing of the directory holding `path`, shared with the Files view. */
function directoryQuery(workspacePath: string, path: string) {
  const directory = parentDirectory(path);
  return { queryKey: queryKeys.inWorkspace(workspacePath, 'explorer', 'directory', directory), queryFn: () => api.explorer.listDirectory(workspacePath, directory) };
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
  const allPaths = useMemo(() => entries?.map((entry) => entry.path) ?? [], [entries]);
  const index = useMemo(() => createFuzzyIndex(allPaths), [allPaths]);
  const results = useMemo(() => index.rank(query, MAX_RESULTS).map((position) => allPaths[position]!), [index, allPaths, query]);

  // The file menu needs the item's version control details: its folder's listing has them (and the Files view may have read it).
  const openActions = async (path: string): Promise<void> => {
    const listing = await queryClient.ensureQueryData(directoryQuery(workspacePath, path));
    setActionsFor(listing.find((item) => item.path === path) ?? null);
  };
  const actions = (item: TreeItem) =>
    runningFirst(fileMenu(workspacePath, [item], new PendingChangesIndex(pendingChanges?.changes ?? [])), () => finish(undefined));

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlighted((current) => Math.min(results.length - 1, Math.max(0, current + step)));
    } else if (event.key === 'Enter' && results[highlighted]) {
      event.preventDefault();
      finish(results[highlighted]);
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
      <div className={styles.results}>
        {isLoading && <CenteredSpinner />}
        {!isLoading && results.length === 0 && <div className={styles.empty}>No files match “{query}”.</div>}
        {results.map((path, index) => (
          <div key={path} className={styles.resultRow} data-highlighted={index === highlighted} onMouseEnter={() => setHighlighted(index)}>
            <button type="button" className={styles.result} onClick={() => finish(path)}>
              {directories.has(path) ? <Folder size={14} className={styles.folder} /> : <File size={14} className={styles.file} />}
              <PathLabel path={path} matches={fuzzyMatchPositions(path, query)} />
            </button>
            {index === highlighted && (
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
          </div>
        ))}
      </div>
      <KeyHints hints={[{ keys: hotkey('rowActions'), label: 'actions' }]} />
    </Dialog>
  );
}
