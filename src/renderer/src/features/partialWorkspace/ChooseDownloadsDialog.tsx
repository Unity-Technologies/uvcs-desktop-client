import { useQueries, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { TreeItem } from '@shared/domain/explorer';
import { workspacePlace } from '@shared/domain/place';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspaceInfoOf } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { Spinner } from '../../ui/Spinner';
import { repositoryListingQuery } from '../browseRepository/repositoryListing';
import { applyDownloads } from './applyDownloads';
import { downloadRules, toggled, type DownloadedChoices } from './downloadSelection';
import { downloadKey, downloadRows, downloadTreeOf, foldersToReadLoaded, rootStatus, rulesSummary } from './downloadTree';
import styles from './ChooseDownloadsDialog.module.css';

const ROOT = '';
const READ_FAILURE = 'Couldn’t read this folder';

/** Lets the user tick what a partial workspace downloads and untick what it removes, then applies it in one go. */
export function openChooseDownloads(workspacePath: string): void {
  openDialog((close) => <ChooseDownloadsDialog workspacePath={workspacePath} close={close} />);
}

function loadedInKey(workspacePath: string, folder: string) {
  return queryKeys.inWorkspace(workspacePath, 'partial', 'loadedIn', folder);
}

function ChooseDownloadsDialog({ workspacePath, close }: { workspacePath: string; close: () => void }) {
  const queryClient = useQueryClient();
  const changesetId = useWorkspaceInfoOf(workspacePath).data?.loadedChangeset;
  const place = workspacePlace(workspacePath);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState(ROOT);
  const [choices, setChoices] = useState<DownloadedChoices>(() => new Map());
  const [applying, setApplying] = useState(false);

  // The repository side: what the workspace's changeset holds, folder by folder, read once and kept.
  const repositoryFolders = [ROOT, ...expanded];
  const listingQueries = useQueries({
    queries: repositoryFolders.map((folder) => ({
      ...repositoryListingQuery(place, changesetId ?? -1, folder),
      enabled: changesetId != null,
    })),
  });
  const listings = new Map<string, readonly TreeItem[]>();
  const failures = new Map<string, string>();
  repositoryFolders.forEach((folder, index) => {
    const query = listingQueries[index]!;
    if (query.data) listings.set(folder, query.data);
    if (query.isError) failures.set(folder, READ_FAILURE);
  });

  // The workspace side: what it holds of each loaded folder. Whether a folder is loaded shows only once its parent is
  // read, so the folders to read come from what this dialog read so far; dropped as it closes (`gcTime` 0), they're
  // read afresh each time it opens, since applying changes them.
  const loadedSoFar = new Map<string, readonly string[]>();
  for (const folder of repositoryFolders) {
    const loaded = queryClient.getQueryData<string[]>(loadedInKey(workspacePath, folder));
    if (loaded) loadedSoFar.set(folder, loaded);
  }
  const loadedFolders = foldersToReadLoaded(downloadTreeOf(listings, loadedSoFar), expanded);
  const loadedQueries = useQueries({
    queries: loadedFolders.map((folder) => ({
      queryKey: loadedInKey(workspacePath, folder),
      queryFn: () => api.workspaces.loadedIn(workspacePath, folder),
      staleTime: Infinity,
      gcTime: 0,
    })),
  });
  const loadedIn = new Map<string, readonly string[]>();
  loadedFolders.forEach((folder, index) => {
    const query = loadedQueries[index]!;
    if (query.data) loadedIn.set(folder, query.data);
    if (query.isError) failures.set(folder, READ_FAILURE);
  });

  const tree = downloadTreeOf(listings, loadedIn);
  const status = rootStatus(tree, failures);
  const rows = downloadRows(tree, choices, expanded, failures);
  const rules = downloadRules(tree, choices);
  const treeId = useId();
  const rowId = (index: number) => `${treeId}-${index}`;
  const selectedIndex = rows.findIndex((row) => row.path === selected);
  const treeRef = useRef<HTMLDivElement>(null);
  // The selection moved by the keyboard stays in sight in a tree taller than the dialog.
  useEffect(() => {
    treeRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const toggleExpanded = (path: string): void =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  const toggleChecked = (path: string): void => setChoices((current) => toggled(path, tree, current));

  const onKeyDown = (event: KeyboardEvent): void => {
    const outcome = downloadKey(rows, selected, event.key);
    if (!outcome) return;
    event.preventDefault();
    if (outcome.select !== undefined) setSelected(outcome.select);
    if (outcome.expand !== undefined) toggleExpanded(outcome.expand);
    if (outcome.check !== undefined) toggleChecked(outcome.check);
  };

  const apply = async (): Promise<void> => {
    setApplying(true);
    const applied = await applyDownloads(workspacePath, rules);
    setApplying(false);
    if (applied) close();
  };

  return (
    <Dialog
      title="Choose what to download"
      width={520}
      onClose={close}
      footer={
        <>
          <span className={styles.summary}>{rulesSummary(rules)}</span>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={rules.length === 0 || applying} onClick={() => void apply()}>
            Apply
          </Button>
        </>
      }
    >
      {status === 'loading' && (
        <div className={styles.message}>
          <Spinner size={14} />
        </div>
      )}
      {status === 'failed' && <div className={styles.message}>{failures.get(ROOT)}</div>}
      {status === 'empty' && <div className={styles.message}>This repository holds no files yet.</div>}
      {status === 'ready' && (
        <div
          ref={treeRef}
          className={styles.tree}
          role="tree"
          aria-label="Choose what to download"
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
              aria-checked={row.check}
              className={styles.row}
              style={{ paddingInlineStart: `calc(${row.level} * var(--space-4) + var(--space-1))` }}
              onClick={() => setSelected(row.path)}
              onDoubleClick={() => row.expandable && toggleExpanded(row.path)}
            >
              <span
                className={styles.chevron}
                onClick={(event) => {
                  event.stopPropagation();
                  if (row.expandable) toggleExpanded(row.path);
                }}
              >
                {row.expandable && (row.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
              </span>
              <Checkbox checked={row.check} focusable={false} ariaLabel={row.name} onChange={() => toggleChecked(row.path)} />
              {row.isDirectory ? <Folder size={14} className={styles.icon} /> : <File size={14} className={styles.icon} />}
              <span className={styles.name}>{row.name}</span>
              {row.note === 'loading' && <Spinner size={12} />}
              {row.note === 'failed' && <span className={styles.failed}>{row.failure}</span>}
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
