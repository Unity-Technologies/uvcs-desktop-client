import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useRef, type ReactNode } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import type { MenuEntry } from '../../lib/actions';
import { formatShortAge } from '../../lib/formatDate';
import { focusMainNear } from '../../lib/mainFocus';
import { hotkey } from '../../lib/shortcutRegistry';
import { Avatar } from '../../ui/Avatar';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { NoMatches } from '../../ui/NoMatches';
import { ResizeHandle } from '../../ui/ResizeHandle';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import type { Column } from '../../ui/table/column';
import { DataTable } from '../../ui/table/DataTable';
import { ListToolbar } from '../ListToolbar';
import { RecordComment } from '../RecordComment';
import { useChangesetListHeightStore } from './changesetListHeightStore';
import {
  CHANGESET_ROW_HEIGHT,
  CHANGESET_ROWS_MIN_HEIGHT,
  CHANGESET_ROWS_MOST_SHARE,
  changesetFilterPlaceholder,
  changesetListPlaces,
  changesetListRowKey,
  changesetRowsDragged,
  changesetRowsHeight,
  changesetRowsMaxHeight,
  changesetRowTip,
} from './changesetStepListModel';
import type { ChangesetStepListState } from './useChangesetStepList';
import styles from './ChangesetStepList.module.css';

interface ChangesetStepListProps {
  list: ChangesetStepListState;
  /** Rows read a step quieter (a review's changesets the user reviewed already). */
  quiet?: (changeset: Changeset) => boolean;
  /** A line with words between two rows that is no row (`DataTable`'s): "Reviewed by you", "Show 200 more". */
  separator?: { beforeKey: string; content: ReactNode };
  /** The most rows shown before the rest scroll inside the list, so what's under it keeps its room, until the user drags its splitter. */
  mostRows: number;
  /** What the rows are, for screen readers. */
  label: string;
  contextMenu: (changesets: Changeset[]) => MenuEntry[];
}

/**
 * Each changeset in one line: the author's avatar, the comment's first line and how long ago, the rest in its tooltip
 * (`changesetRowTip`: its number too, which the filter still finds; on every row it said little and took the comment's
 * room).
 */
function changesetColumns(quiet: ((changeset: Changeset) => boolean) | undefined, now: number): Column<Changeset>[] {
  return [
    {
      id: 'changeset',
      header: 'Changeset',
      render: (changeset) => {
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
 * step to the changeset before or after (`previousChangeset`, `nextChangeset`), and the rows, oldest on top, under the
 * row that stands for them all, which the place shows above the list (`ChangesetFold`). Several selected show as one
 * diff and read as one band (`changesetListSelection`). Only the rows in view render (`DataTable`).
 */
export function ChangesetStepList({ list, quiet, separator, mostRows, label, contextMenu }: ChangesetStepListProps) {
  const { changesets, shown, query, setQuery, selection, select, revealKey, stepsTo, stepTo } = list;
  const reading = changesets === undefined;
  // How long ago, as of each time the rows change (read again, filtered): not on every step.
  const columns = useMemo(() => changesetColumns(quiet, Date.now()), [quiet, shown]);
  const { rowsHeight: dragged, setRowsHeight } = useChangesetListHeightStore();
  const rowsRef = useRef<HTMLDivElement>(null);
  const places = reading ? undefined : changesetListPlaces(shown, separator?.beforeKey);
  const height = changesetRowsHeight(places, mostRows, dragged);
  return (
    <div className={styles.list}>
      <ResizeHandle
        edge="bottom"
        size={height}
        min={CHANGESET_ROWS_MIN_HEIGHT}
        // As the window is when the drag starts, which may have changed since the list was last drawn.
        max={() => changesetRowsMaxHeight(window.innerHeight)}
        // From what shows, which a short list keeps under the height dragged before.
        measure={() => rowsRef.current?.offsetHeight ?? height}
        onResize={(result) => setRowsHeight(changesetRowsDragged(result, places, mostRows, dragged))}
        onReset={() => setRowsHeight(null)}
      />
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
      <div ref={rowsRef} className={styles.rows} style={{ height, maxHeight: `${CHANGESET_ROWS_MOST_SHARE * 100}vh` }}>
        {reading ? (
          <ListSkeleton rowHeight={CHANGESET_ROW_HEIGHT} />
        ) : (
          <HighlightQuery query={query}>
            <DataTable
              rows={shown}
              columns={columns}
              rowKey={changesetListRowKey}
              selection={selection}
              // A row picked in the list is already in view; the one stepped to before isn't revealed again.
              onSelectionChange={(next) => select(next)}
              contextMenu={contextMenu}
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
