import { useMemo } from 'react';
import type { ItemRevision } from '@shared/domain/history';
import type { Label } from '@shared/domain/label';
import { shortBranchName } from '@shared/domain/specs';
import { LabelChips } from '../../components/LabelChips';
import { RECORD_ROW_HEIGHT, RecordComment, RecordRow, recordRowStyles } from '../../components/RecordRow';
import { WorkspaceMark } from '../../components/WorkspaceMark';
import type { MenuEntry } from '../../lib/actions';
import type { SelectionState } from '../../lib/selection';
import { displayName } from '../../lib/userName';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import type { Column } from '../../ui/table/column';
import { DataTable } from '../../ui/table/DataTable';
import { useLabelsByChangeset } from '../labels/useLabelsByChangeset';
import { changesetOf, dateOf, historyRowKey, ownerOf, type HistoryRow } from './historyRows';
import styles from './HistoryList.module.css';

/** Two lines a row: the comment, then where and by whom. */
export const HISTORY_ROW_HEIGHT = RECORD_ROW_HEIGHT;

interface HistoryListProps {
  rows: readonly HistoryRow[];
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  contextMenu: (selected: HistoryRow[]) => MenuEntry[];
  /** The revision the workspace has, marked with the house. */
  workspaceRevisionId?: number;
  /** Scrolls this row into view when it changes: one selected from the annotation. */
  revealKey?: string | null;
  /** The repository of a file under an xlink, whose changesets carry none of the workspace's labels. */
  otherRepository?: string;
}

/** The file's revisions and moves, newest first, as the lists of changesets read: avatar, comment, then its details. */
export function HistoryList({ rows, selection, onSelectionChange, contextMenu, workspaceRevisionId, revealKey, otherRepository }: HistoryListProps) {
  const labelsByChangeset = useLabelsByChangeset(otherRepository);
  const columns = useMemo(() => [revisionColumn(labelsByChangeset, workspaceRevisionId)], [labelsByChangeset, workspaceRevisionId]);
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={historyRowKey}
      selection={selection}
      onSelectionChange={onSelectionChange}
      contextMenu={contextMenu}
      rowHeight={HISTORY_ROW_HEIGHT}
      divided
      revealKey={revealKey}
      label="Revisions"
      hideHeader
    />
  );
}

function revisionColumn(labelsByChangeset: ReadonlyMap<number, readonly Label[]>, workspaceRevisionId: number | undefined): Column<HistoryRow> {
  return {
    id: 'revision',
    header: 'Revision',
    render: (row) => (
      <RecordRow
        owner={ownerOf(row)}
        title={
          row.kind === 'revision' ? (
            <RevisionTitle revision={row.revision} labels={labelsByChangeset.get(row.revision.changesetId)} isWorkspaceRevision={row.revision.revisionId === workspaceRevisionId} />
          ) : (
            // A move or removal: what cm says happened, told apart from the changesets' own comments.
            <span className={styles.pathChange} data-tip-overflow data-tip={row.change.description}>
              <Highlight text={row.change.description} />
            </span>
          )
        }
        meta={<RowMeta row={row} />}
      />
    ),
  };
}

/** A revision's first line: its labels, the comment's first line, and the house when the workspace has it. */
function RevisionTitle({ revision, labels, isWorkspaceRevision }: { revision: ItemRevision; labels: readonly Label[] | undefined; isWorkspaceRevision: boolean }) {
  return (
    <>
      <LabelChips labels={labels} />
      <RecordComment comment={revision.comment} />
      {isWorkspaceRevision && <WorkspaceMark on="revision" />}
    </>
  );
}

/** A row's second line: cs:N · branch · author · date. */
function RowMeta({ row }: { row: HistoryRow }) {
  return (
    <>
      <span className="mono">
        cs:<Highlight text={String(changesetOf(row))} />
      </span>
      {/* The branch by its own name (task branches nest deep), whole in its tooltip. The author gives way first: the avatar already says who. */}
      {row.kind === 'revision' && (
        <span className={styles.branch} data-tip={row.revision.branch}>
          <Highlight text={shortBranchName(row.revision.branch)} />
        </span>
      )}
      <span className={recordRowStyles.clipped}>
        <Highlight text={displayName(ownerOf(row))} />
      </span>
      <span className={recordRowStyles.date}>
        <RelativeTime date={dateOf(row)} />
      </span>
    </>
  );
}
