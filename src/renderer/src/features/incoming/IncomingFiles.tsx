import { FileSearch } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import { FileTreeList } from '../../components/FileTreeList';
import type { MenuEntry } from '../../lib/actions';
import type { GroupedTreeRow } from '../../lib/groupedPathTree';
import type { SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { DiffEntryRow } from '../diff/DiffEntryRow';
import { incomingGroupTip, type IncomingListGroup } from './incomingScope';
import type { FileTreeFolding } from '../../components/fileTreeFolding';
import styles from './IncomingFiles.module.css';

interface IncomingFilesProps {
  /** What the files are, for screen readers (`incomingFilesLabel`). */
  label: string;
  /** The scope's files; undefined until they are in. */
  files: DiffEntry[] | undefined;
  rows: GroupedTreeRow<DiffEntry, IncomingListGroup>[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
  /** Closing or opening every group and folder, from the view menu; null for a flat list. */
  folding: FileTreeFolding | null;
  query: string;
  filterBar: ReactNode;
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  contextMenu: (files: DiffEntry[]) => MenuEntry[];
  /** The Unity `.meta` each asset's row stands for too (`pairIncomingMetas`): tagged "+ meta". */
  metaOf: (file: DiffEntry) => DiffEntry | undefined;
  /** Where a file that collides with local changes stands. */
  markOf: (file: DiffEntry) => ReactNode;
  /** While the filters hide every file: `NoMatches`. */
  noMatches?: ReactNode;
}

/**
 * Incoming's files: what the whole update brings, or what some changesets changed, as every list of changed files shows
 * them. No header names them: the row selected in the changesets above does, as in a branch diff.
 */
export function IncomingFiles({ label, files, rows, tree, toggleCollapsed, folding, query, filterBar, selection, onSelectionChange, contextMenu, metaOf, markOf, noMatches }: IncomingFilesProps) {
  return (
    <div className={styles.files}>
      {files?.length === 0 ? (
        <EmptyState icon={<FileSearch size={22} />} title="No file changes" />
      ) : (
        <FileTreeList
          rows={rows}
          tree={tree}
          toggleCollapsed={toggleCollapsed}
          folding={folding}
          renderItem={(row, level) => <DiffEntryRow row={row} level={level} tree={tree} extras={row.type === 'file' ? markOf(row.item) : undefined} hasMeta={row.item !== undefined && metaOf(row.item) !== undefined} />}
          groupTip={incomingGroupTip}
          query={query}
          filterBar={filterBar}
          selection={selection}
          onSelectionChange={onSelectionChange}
          contextMenu={contextMenu}
          label={label}
          loading={!files}
          noMatches={noMatches}
        />
      )}
    </div>
  );
}
