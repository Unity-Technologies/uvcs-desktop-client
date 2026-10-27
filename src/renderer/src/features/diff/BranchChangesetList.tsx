import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import { ListToolbar } from '../../components/ListToolbar';
import { RECORD_ROW_HEIGHT, RecordComment, RecordRow, recordRowStyles } from '../../components/RecordRow';
import type { MenuEntry } from '../../lib/actions';
import { focusMainNear } from '../../lib/mainFocus';
import type { SelectionState } from '../../lib/selection';
import { hotkey } from '../../lib/shortcutRegistry';
import { displayName } from '../../lib/userName';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { NoMatches } from '../../ui/NoMatches';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import type { Column } from '../../ui/table/column';
import { DataTable } from '../../ui/table/DataTable';
import { changesetFilterPlaceholder } from './changesetByChangeset';
import styles from './BranchChangesetList.module.css';

/** Each changeset as History reads a revision (`RecordRow`): the comment, then cs:N · author · date. */
const CHANGESET_COLUMNS: Column<Changeset>[] = [
  {
    id: 'changeset',
    header: 'Changeset',
    render: (changeset) => (
      <RecordRow
        owner={changeset.owner}
        title={<RecordComment comment={changeset.comment} />}
        meta={
          <>
            <span className="mono">
              cs:<Highlight text={String(changeset.id)} />
            </span>
            <span className={recordRowStyles.clipped}>
              <Highlight text={displayName(changeset.owner)} />
            </span>
            <span className={recordRowStyles.date}>
              <RelativeTime date={changeset.date} />
            </span>
          </>
        }
      />
    ),
  },
];

/** Kept out of the render: a new `rowKey` makes the table key every changeset of the branch again on each step. */
const changesetKey = (changeset: Changeset): string => String(changeset.id);

interface BranchChangesetListProps {
  /** The branch's changesets, newest first; undefined while they're read. */
  changesets: readonly Changeset[] | undefined;
  /** The ones the filter shows. */
  shown: readonly Changeset[];
  query: string;
  onQueryChange: (query: string) => void;
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  /** The changeset the buttons and keys step to, up (-1, newer) or down (1, older); null at either end. */
  stepsTo: (step: 1 | -1) => number | null;
  onStep: (step: 1 | -1) => void;
  /** Scrolled into view: the changeset stepped to. */
  revealKey: string | null;
  contextMenu: (selected: Changeset[]) => MenuEntry[];
}

/**
 * A branch's changesets above the files of the one selected, in "Changeset by changeset": a filter, the buttons that
 * step to the changeset before or after (`previousChangeset`, `nextChangeset`), and the changesets as compact rows.
 */
export function BranchChangesetList({ changesets, shown, query, onQueryChange, selection, onSelectionChange, stepsTo, onStep, revealKey, contextMenu }: BranchChangesetListProps) {
  const reading = changesets === undefined;
  return (
    <div className={styles.list}>
      <ListToolbar>
        <div className={styles.bar}>
          <SearchField
            value={query}
            onChange={onQueryChange}
            placeholder={changesetFilterPlaceholder(changesets?.length)}
            aria-label="Filter changesets"
            width="100%"
            disabled={reading}
            // ↓ goes on to the changesets, as a view's filter goes on to its list (`FilterField`).
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && focusMainNear(event.currentTarget)) event.preventDefault();
            }}
          />
          <IconButton size="small" icon={<ChevronUp size={14} />} label="Previous changeset" shortcut={hotkey('previousChangeset')} disabled={stepsTo(-1) === null} onClick={() => onStep(-1)} />
          <IconButton size="small" icon={<ChevronDown size={14} />} label="Next changeset" shortcut={hotkey('nextChangeset')} disabled={stepsTo(1) === null} onClick={() => onStep(1)} />
        </div>
      </ListToolbar>
      {reading ? (
        <ListSkeleton rowHeight={RECORD_ROW_HEIGHT} />
      ) : (
        <HighlightQuery query={query}>
          <DataTable
            rows={shown}
            columns={CHANGESET_COLUMNS}
            rowKey={changesetKey}
            selection={selection}
            onSelectionChange={onSelectionChange}
            contextMenu={contextMenu}
            revealKey={revealKey}
            rowHeight={RECORD_ROW_HEIGHT}
            divided
            label="Changesets"
            hideHeader
            empty={<NoMatches noun="changesets" onClear={() => onQueryChange('')} />}
          />
        </HighlightQuery>
      )}
    </div>
  );
}
