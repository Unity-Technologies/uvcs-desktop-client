import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { ListToolbar } from '../../components/ListToolbar';
import { RecordComment } from '../../components/RecordComment';
import type { MenuEntry } from '../../lib/actions';
import { formatShortAge } from '../../lib/formatDate';
import { focusMainNear } from '../../lib/mainFocus';
import type { SelectionState } from '../../lib/selection';
import { hotkey } from '../../lib/shortcutRegistry';
import { Avatar } from '../../ui/Avatar';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { NoMatches } from '../../ui/NoMatches';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import type { Column } from '../../ui/table/column';
import { DataTable } from '../../ui/table/DataTable';
import { ToggleChip } from '../../ui/ToggleChip';
import { changesetMark, changesetRowTip, reviewedSeparator, type ReviewedUpTo } from './branchChangesetRows';
import { changesetFilterPlaceholder } from './changesetByChangeset';
import styles from './BranchChangesetList.module.css';

/** A row's height: one line, as a commit picker lists them. */
const CHANGESET_ROW_HEIGHT = 28;

/** Kept out of the render: a new `rowKey` makes the table key every changeset of the branch again on each step. */
const changesetKey = (changeset: Changeset): string => String(changeset.id);

/**
 * Each changeset in one line: the author's avatar, the comment's first line and how long ago, the rest in its tooltip
 * (`changesetRowTip`: its number too, which the filter still finds; on every row it said little and took the comment's
 * room). With the user's review (`reviewedUpTo`), a dot marks what's new since; what they
 * reviewed reads a step quieter.
 */
function changesetColumns(reviewedUpTo: ReviewedUpTo | undefined, now: number): Column<Changeset>[] {
  return [
    {
      id: 'changeset',
      header: 'Changeset',
      render: (changeset) => {
        const tip = changesetRowTip(changeset);
        return (
          <span className={styles.row} data-mark={changesetMark(changeset, reviewedUpTo) ?? undefined} data-tip={tip.text} data-tip-sub={tip.sub}>
            {reviewedUpTo && <span className={styles.newDot} aria-hidden />}
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

interface BranchChangesetListProps {
  /** The branch's changesets, newest first; undefined while they're read. */
  changesets: readonly Changeset[] | undefined;
  /** The ones the filters show. */
  shown: readonly Changeset[];
  query: string;
  onQueryChange: (query: string) => void;
  /** Where the user left off reviewing the branch: its changesets are marked new or reviewed. */
  reviewedUpTo?: ReviewedUpTo;
  /** How many changesets are new since; New shows while any is. */
  newCount: number;
  onlyNew: boolean;
  onOnlyNewChange: (onlyNew: boolean) => void;
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
 * A branch's changesets above the files of those selected, in "Changeset by changeset": a filter, New, the buttons
 * that step to the changeset before or after (`previousChangeset`, `nextChangeset`), and the changesets in one line
 * each, "Reviewed by you" between the new ones and those the user reviewed.
 */
export function BranchChangesetList({
  changesets,
  shown,
  query,
  onQueryChange,
  reviewedUpTo,
  newCount,
  onlyNew,
  onOnlyNewChange,
  selection,
  onSelectionChange,
  stepsTo,
  onStep,
  revealKey,
  contextMenu,
}: BranchChangesetListProps) {
  const reading = changesets === undefined;
  // How long ago, as of each time the changesets shown change (read again, filtered): not on every step.
  const columns = useMemo(() => changesetColumns(reviewedUpTo, Date.now()), [reviewedUpTo, shown]);
  const separator = useMemo(() => reviewedSeparator(shown, reviewedUpTo, Date.now()), [reviewedUpTo, shown]);
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
          {newCount > 0 && (
            <ToggleChip size="small" pressed={onlyNew} onChange={onOnlyNewChange} data-tip="Only the changesets new since your review">
              New <span className={styles.newCount}>{newCount}</span>
            </ToggleChip>
          )}
          <IconButton size="small" icon={<ChevronUp size={14} />} label="Previous changeset" shortcut={hotkey('previousChangeset')} disabled={stepsTo(-1) === null} onClick={() => onStep(-1)} />
          <IconButton size="small" icon={<ChevronDown size={14} />} label="Next changeset" shortcut={hotkey('nextChangeset')} disabled={stepsTo(1) === null} onClick={() => onStep(1)} />
        </div>
      </ListToolbar>
      {reading ? (
        <ListSkeleton rowHeight={CHANGESET_ROW_HEIGHT} />
      ) : (
        <HighlightQuery query={query}>
          <DataTable
            rows={shown}
            columns={columns}
            rowKey={changesetKey}
            selection={selection}
            onSelectionChange={onSelectionChange}
            contextMenu={contextMenu}
            revealKey={revealKey}
            rowHeight={CHANGESET_ROW_HEIGHT}
            label="Changesets"
            hideHeader
            empty={<NoMatches noun="changesets" onClear={() => onQueryChange('')} />}
            separator={
              separator && {
                beforeKey: separator.beforeKey,
                content: (
                  <span className={styles.reviewed} data-tip={separator.tip}>
                    <Check size={12} aria-hidden />
                    {separator.label}
                  </span>
                ),
              }
            }
          />
        </HighlightQuery>
      )}
    </div>
  );
}
