import { commentLineText } from '../../lib/comments/commentText';
import { FileSearch, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import type { DiffEntry } from '@shared/domain/diff';
import { FileTreeList } from '../../components/FileTreeList';
import type { MenuEntry } from '../../lib/actions';
import type { GroupedTreeRow } from '../../lib/groupedPathTree';
import type { SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { SkeletonBar } from '../../ui/Skeleton';
import { DiffEntryRow } from '../diff/DiffEntryRow';
import { INCOMING_GROUP_TIPS, type IncomingFileGroup } from './incomingScope';
import styles from './IncomingFiles.module.css';

interface IncomingFilesProps {
  /** The changeset whose files show; none for the whole update. */
  changeset?: Changeset;
  onShowAll: () => void;
  /** The scope's files; undefined until they are in. */
  files: DiffEntry[] | undefined;
  /** What they are, under the header (`incomingFilesSummary`). */
  summary: string;
  rows: GroupedTreeRow<DiffEntry, IncomingFileGroup>[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
  query: string;
  filterBar: ReactNode;
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  contextMenu: (files: DiffEntry[]) => MenuEntry[];
  /** Where a file that collides with local changes stands. */
  markOf: (file: DiffEntry) => ReactNode;
  /** While the filters hide every file: `NoMatches`. */
  noMatches?: ReactNode;
}

/** Incoming's files: what the whole update brings, or what one changeset changed, as every list of changed files shows them. */
export function IncomingFiles({ changeset, onShowAll, files, summary, rows, tree, toggleCollapsed, query, filterBar, selection, onSelectionChange, contextMenu, markOf, noMatches }: IncomingFilesProps) {
  return (
    <div className={styles.files}>
      <div className={styles.header}>
        <span className={styles.title} data-tip={changeset ? commentLineText(changeset.comment) : undefined}>
          {changeset ? `cs:${changeset.id} · ${commentLineText(changeset.comment) || 'No comment'}` : 'All incoming changes'}
        </span>
        {changeset && <IconButton icon={<X size={13} />} label="Show all incoming changes" size="small" onClick={onShowAll} />}
      </div>
      {/* While the files are read, their summary, filter and rows hold their places. */}
      {(!files || files.length > 0) && <div className={styles.summary}>{files ? summary : <SkeletonBar width="160px" />}</div>}
      {files?.length === 0 ? (
        <EmptyState icon={<FileSearch size={22} />} title="No file changes" />
      ) : (
        <FileTreeList
          rows={rows}
          tree={tree}
          toggleCollapsed={toggleCollapsed}
          renderItem={(row, level) => <DiffEntryRow row={row} level={level} tree={tree} extras={row.type === 'file' ? markOf(row.item) : undefined} />}
          groupTip={(group) => INCOMING_GROUP_TIPS[group]}
          query={query}
          filterBar={filterBar}
          selection={selection}
          onSelectionChange={onSelectionChange}
          contextMenu={contextMenu}
          label={changeset ? `Files changed in cs:${changeset.id}` : 'Incoming files'}
          loading={!files}
          noMatches={noMatches}
        />
      )}
    </div>
  );
}
