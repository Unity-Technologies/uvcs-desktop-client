import { useMemo } from 'react';
import type { Label } from '@shared/domain/label';
import { LabelChips } from '../../components/LabelChips';
import { WorkspaceMark } from '../../components/WorkspaceMark';
import type { MenuEntry } from '../../lib/actions';
import type { SelectionState } from '../../lib/selection';
import { firstLine } from '../../lib/text';
import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { useLabelsByChangeset } from '../labels/useLabelsByChangeset';
import { changesetOf, historyRowKey, type HistoryRow } from './historyRows';
import styles from './HistoryList.module.css';

/** Two lines a row: the comment, then where and by whom. */
export const HISTORY_ROW_HEIGHT = 50;

interface HistoryListProps {
  rows: readonly HistoryRow[];
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  contextMenu: (selected: HistoryRow[]) => MenuEntry[];
  /** The revision the workspace has, marked with the house. */
  workspaceRevisionId?: number;
  /** Scrolls this row into view when it changes: one selected from the annotation. */
  revealKey?: string | null;
}

/** The file's revisions and moves, newest first, as the lists of changesets read: avatar, comment, then its details. */
export function HistoryList({ rows, selection, onSelectionChange, contextMenu, workspaceRevisionId, revealKey }: HistoryListProps) {
  const labelsByChangeset = useLabelsByChangeset();
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
    render: (row) => {
      const owner = row.kind === 'revision' ? row.revision.owner : row.change.owner;
      const date = row.kind === 'revision' ? row.revision.date : row.change.date;
      const comment = row.kind === 'revision' ? firstLine(row.revision.comment) : '';
      return (
        <span className={styles.row}>
          <Avatar user={owner} size={24} />
          <span className={styles.text}>
            <span className={styles.title}>
              {row.kind === 'revision' ? (
                <>
                  <LabelChips labels={labelsByChangeset.get(row.revision.changesetId)} />
                  {comment ? (
                    <span className={styles.clipped}>
                      <Highlight text={comment} />
                    </span>
                  ) : (
                    <span className={styles.noComment}>No comment</span>
                  )}
                  {row.revision.revisionId === workspaceRevisionId && <WorkspaceMark on="revision" />}
                </>
              ) : (
                // A move or removal: what cm says happened, told apart from the changesets' own comments.
                <span className={styles.pathChange} data-tip-overflow data-tip={row.change.description}>
                  <Highlight text={row.change.description} />
                </span>
              )}
            </span>
            <span className={styles.meta}>
              <span className="mono">
                cs:<Highlight text={String(changesetOf(row))} />
              </span>
              {/* The branch by its own name (task branches nest deep), whole in its tooltip. The author gives way first: the avatar already says who. */}
              {row.kind === 'revision' && (
                <span className={styles.branch} data-tip={row.revision.branch}>
                  <Highlight text={row.revision.branch.split('/').at(-1) || row.revision.branch} />
                </span>
              )}
              <span className={styles.clipped}>
                <Highlight text={displayName(owner)} />
              </span>
              <span className={styles.date}>
                <RelativeTime date={date} />
              </span>
            </span>
          </span>
        </span>
      );
    },
  };
}
