import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import { ListToolbar } from '../../components/ListToolbar';
import { avatarColumn, commentColumn, dateColumn, numberColumn } from '../../components/historyColumns';
import type { MenuEntry } from '../../lib/actions';
import { focusMainNear } from '../../lib/mainFocus';
import type { SelectionState } from '../../lib/selection';
import { hotkey } from '../../lib/shortcutRegistry';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { NoMatches } from '../../ui/NoMatches';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import type { Column } from '../../ui/table/column';
import { DataTable } from '../../ui/table/DataTable';
import { changesetFilterPlaceholder } from './changesetByChangeset';
import styles from './BranchChangesetList.module.css';

/** The Changesets view's columns that fit above a diff's files; the avatar, whose tooltip names the author, always shows. */
const CHANGESET_COLUMNS: Column<Changeset>[] = [avatarColumn({ alwaysShown: true }), numberColumn('Changeset'), commentColumn(), dateColumn()];

/** The table's own row height, the placeholder rows' too. */
const ROW_HEIGHT = 30;

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
        <ListSkeleton rowHeight={ROW_HEIGHT} />
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
            rowHeight={ROW_HEIGHT}
            label="Changesets"
            hideHeader
            empty={<NoMatches noun="changesets" onClear={() => onQueryChange('')} />}
          />
        </HighlightQuery>
      )}
    </div>
  );
}
