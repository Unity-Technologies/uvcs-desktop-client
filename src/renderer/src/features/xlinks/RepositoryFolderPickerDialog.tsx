import { useQueries, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { XlinkPoint } from '@shared/domain/xlinks';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { Spinner } from '../../ui/Spinner';
import { folderKey, folderListingOf, folderRows, initiallyExpanded, openingFolder, toggled, type FolderListing } from './repositoryFolderTree';
import styles from './RepositoryFolderPickerDialog.module.css';

interface PickRepositoryFolderOptions {
  title: string;
  /** `name@server`. */
  repository: string;
  /** Where the tree is read. */
  point: XlinkPoint;
  /** The folder chosen so far, open and selected as the picker opens (`/` for the root). */
  current: string;
}

/** Asks the user to choose a folder of a repository's tree, browsing it a folder at a time. Resolves to its `/`-rooted path. */
export function pickRepositoryFolder(options: PickRepositoryFolderOptions): Promise<string | undefined> {
  return askDialog<string>((finish) => <RepositoryFolderPickerDialog {...options} finish={finish} />);
}

function RepositoryFolderPickerDialog({ title, repository, point, current, finish }: PickRepositoryFolderOptions & { finish: (folder: string | undefined) => void }) {
  const workspacePath = useWorkspacePath();
  const [expanded, setExpanded] = useState(() => initiallyExpanded(current));
  const [selected, setSelected] = useState(() => openingFolder(current));
  // Read once a dialog shows it, and kept a while: browsing the same tree again asks nothing.
  const treeQuery = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'xlinks', 'tree', repository, point),
    queryFn: () => api.xlinks.treePoint(workspacePath, repository, point),
    ...SLOW_CHANGING_QUERY,
  });
  const treeSpec = treeQuery.data;
  const folderQueries = useQueries({
    queries: [...expanded].map((folder) => ({
      queryKey: queryKeys.inWorkspace(workspacePath, 'xlinks', 'folders', treeSpec, folder),
      queryFn: () => api.xlinks.folders(workspacePath, treeSpec!, folder),
      enabled: treeSpec !== undefined,
      ...SLOW_CHANGING_QUERY,
    })),
  });
  const listings = new Map<string, FolderListing>([...expanded].map((folder, index) => [folder, folderListingOf(treeQuery.error, folderQueries[index]!)]));
  const rows = folderRows(repository, listings, expanded);
  const treeId = useId();
  const rowId = (index: number) => `${treeId}-${index}`;
  const selectedIndex = rows.findIndex((row) => row.path === selected);
  const treeRef = useRef<HTMLDivElement>(null);
  // The selection moved by the keyboard stays in sight in a tree taller than the dialog.
  useEffect(() => {
    treeRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const onKeyDown = (event: KeyboardEvent): void => {
    const outcome = folderKey(rows, selected, event.key);
    if (!outcome) return;
    event.preventDefault();
    if (outcome.select) setSelected(outcome.select);
    if (outcome.toggle) setExpanded((open) => toggled(open, outcome.toggle!));
    if (outcome.choose) finish(outcome.choose);
  };

  return (
    <Dialog
      title={title}
      width={460}
      onClose={() => finish(undefined)}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button variant="primary" onClick={() => finish(selected)}>
            Choose folder
          </Button>
        </>
      }
    >
      <div
        ref={treeRef}
        className={styles.tree}
        role="tree"
        aria-label={title}
        aria-activedescendant={selectedIndex >= 0 ? rowId(selectedIndex) : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        autoFocus
      >
        {rows.map((row, index) => (
          <div
            key={row.path}
            id={rowId(index)}
            role="treeitem"
            aria-selected={row.path === selected}
            aria-expanded={row.expandable ? row.expanded : undefined}
            className={styles.row}
            style={{ paddingInlineStart: `calc(${row.level} * var(--space-4) + var(--space-1))` }}
            onClick={() => setSelected(row.path)}
            onDoubleClick={() => finish(row.path)}
          >
            <span
              className={styles.chevron}
              onClick={(event) => {
                event.stopPropagation();
                if (row.expandable) setExpanded((open) => toggled(open, row.path));
              }}
            >
              {row.expandable && (row.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
            </span>
            <Folder size={14} className={styles.icon} />
            <span className={styles.name}>{row.name}</span>
            {row.note === 'loading' && <Spinner size={12} />}
            {row.note === 'failed' && <span className={styles.failed}>{row.failure}</span>}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
