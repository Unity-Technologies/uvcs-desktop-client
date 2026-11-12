import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import type { MenuEntry } from '../../lib/actions';
import { formatShortAge } from '../../lib/formatDate';
import { focusMainNear } from '../../lib/mainFocus';
import { hotkey } from '../../lib/shortcutRegistry';
import { Avatar } from '../../ui/Avatar';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { NoMatches } from '../../ui/NoMatches';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import type { Column } from '../../ui/table/column';
import { DataTable } from '../../ui/table/DataTable';
import { ListToolbar } from '../ListToolbar';
import { RecordComment } from '../RecordComment';
import { CHANGESET_ROW_HEIGHT, changesetFilterPlaceholder, changesetListPlaces, changesetListRowKey, changesetRowsHeight, changesetRowTip, type ChangesetListRow } from './changesetStepListModel';
import type { ChangesetStepListState } from './useChangesetStepList';
import styles from './ChangesetStepList.module.css';

/** The row standing for every changeset combined: its words, fitted, and its tooltip. */
export interface AllChangesRow {
  label: string;
  tip?: string;
}

interface ChangesetStepListProps {
  list: ChangesetStepListState;
  allChanges: AllChangesRow;
  /** Rows read a step quieter (a review's changesets the user reviewed already). */
  quiet?: (changeset: Changeset) => boolean;
  /** A line with words between two rows that is no row (`DataTable`'s): "Reviewed by you", "Show 200 more". */
  separator?: { beforeKey: string; content: ReactNode };
  /** The most rows shown before the rest scroll inside the list, so what's under it keeps its room. */
  mostRows: number;
  /** What the rows are, for screen readers. */
  label: string;
  contextMenu: (changesets: Changeset[]) => MenuEntry[];
}

/**
 * Each row in one line: everything combined first, then each changeset with the author's avatar, the comment's first
 * line and how long ago, the rest in its tooltip (`changesetRowTip`: its number too, which the filter still finds; on
 * every row it said little and took the comment's room).
 */
function changesetColumns(allChanges: AllChangesRow, quiet: ((changeset: Changeset) => boolean) | undefined, now: number): Column<ChangesetListRow>[] {
  return [
    {
      id: 'changeset',
      header: 'Changeset',
      render: (row) => {
        if (row.kind === 'all') {
          return (
            <span className={styles.row} data-tip={allChanges.tip}>
              <Layers size={14} className={styles.allIcon} aria-hidden />
              <span className={styles.allLabel}>{allChanges.label}</span>
            </span>
          );
        }
        const { changeset } = row;
        const tip = changesetRowTip(changeset);
        return (
          <span className={styles.row} data-quiet={quiet?.(changeset) || undefined} data-tip={tip.text} data-tip-sub={tip.sub}>
            <Avatar user={changeset.owner} size={16} tip={null} />
            <span className={styles.comment}>
              <RecordComment comment={changeset.comment} />
            </span>
            <span className={styles.age}>{formatShortAge(changeset.date, now)}</span>
          </span>
        );
      },
    },
  ];
}

/**
 * Changesets to step through above the files of what's selected (a branch diff, Incoming): a filter, the buttons that
 * step to the changeset before or after (`previousChangeset`, `nextChangeset`), and the rows, oldest on top under the
 * one that stands for them all. Several selected show as one diff and read as one band (`changesetListSelection`).
 * Only the rows in view render (`DataTable`).
 */
export function ChangesetStepList({ list, allChanges, quiet, separator, mostRows, label, contextMenu }: ChangesetStepListProps) {
  const { changesets, rows, query, setQuery, selection, select, revealKey, stepsTo, stepTo } = list;
  const reading = changesets === undefined;
  // How long ago, as of each time the rows change (read again, filtered): not on every step.
  const columns = useMemo(() => changesetColumns(allChanges, quiet, Date.now()), [allChanges.label, allChanges.tip, quiet, rows]);
  const height = changesetRowsHeight(reading ? undefined : changesetListPlaces(rows, separator?.beforeKey), mostRows);
  return (
    <div className={styles.list}>
      <ListToolbar>
        <div className={styles.bar}>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={changesetFilterPlaceholder(changesets?.length)}
            aria-label="Filter changesets"
            width="100%"
            disabled={reading}
            // ↓ goes on to the changesets, as a view's filter goes on to its list (`FilterField`).
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && focusMainNear(event.currentTarget)) event.preventDefault();
            }}
          />
          <IconButton size="small" icon={<ChevronUp size={14} />} label="Previous changeset" shortcut={hotkey('previousChangeset')} disabled={stepsTo(-1) === null} onClick={() => stepTo(-1)} />
          <IconButton size="small" icon={<ChevronDown size={14} />} label="Next changeset" shortcut={hotkey('nextChangeset')} disabled={stepsTo(1) === null} onClick={() => stepTo(1)} />
        </div>
      </ListToolbar>
      <div className={styles.rows} style={{ height }}>
        {reading ? (
          <ListSkeleton rowHeight={CHANGESET_ROW_HEIGHT} />
        ) : (
          <HighlightQuery query={query}>
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={changesetListRowKey}
              selection={selection}
              // A row picked in the list is already in view; the one stepped to before isn't revealed again.
              onSelectionChange={(next) => select(next)}
              contextMenu={(selected) => contextMenu(selected.flatMap((row) => (row.kind === 'changeset' ? [row.changeset] : [])))}
              revealKey={revealKey}
              rowHeight={CHANGESET_ROW_HEIGHT}
              label={label}
              hideHeader
              empty={<NoMatches noun="changesets" onClear={() => setQuery('')} />}
              separator={separator}
            />
          </HighlightQuery>
        )}
      </div>
    </div>
  );
}
