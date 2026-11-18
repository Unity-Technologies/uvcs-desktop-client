import { useEffect, useRef, useState } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { ChangesetFold } from '../../components/changesetList/ChangesetFold';
import { changesetFoldLabel } from '../../components/changesetList/changesetListFold';
import { ChangesetStepList } from '../../components/changesetList/ChangesetStepList';
import { CHANGESET_LIST_MOST_ROWS } from '../../components/changesetList/changesetStepListModel';
import type { ChangesetStepListState } from '../../components/changesetList/useChangesetStepList';
import type { MenuEntry } from '../../lib/actions';
import { focusMainNear } from '../../lib/mainFocus';
import { singleSelection } from '../../lib/selection';
import { showMoreBeforeKey } from './incomingChangesetSection';
import { IncomingShowMore } from './IncomingShowMore';
import { showMoreLanding } from './showMoreLanding';

/** The row standing for the whole update, above the changesets, which folds them. */
export const ALL_INCOMING_ROW = { label: 'All incoming changes' };

interface IncomingChangesetListProps {
  /** The list's state (`useChangesetStepList`, `allApart`), over the changesets read so far, newest first. */
  list: ChangesetStepListState;
  /** The changesets read so far, newest first. */
  changesets: Changeset[];
  /** Older changesets remain to be read. */
  more: boolean;
  open: boolean;
  /** Opens or folds the list; folding goes back to all the incoming changes (`toggledFold`). */
  onToggle: () => void;
  onSelectAll: () => void;
  changesetMenu: (changesets: Changeset[]) => MenuEntry[];
  /** Older changesets remain to be read: "Show more", above the oldest one, reads the next page. */
  older?: { loading: boolean; onShowMore: () => void };
}

/**
 * The incoming changesets as a branch diff lists its own (`ChangesetFold`, `ChangesetStepList`): "All incoming changes"
 * apart above them, the whole update, folding them at its end, and each changeset one row under it, what the list of
 * changesets read (comment, author, date): nothing is asked of `cm` per row.
 */
export function IncomingChangesetList({ list, changesets, more, open, onToggle, onSelectAll, changesetMenu, older }: IncomingChangesetListProps) {
  const showMoreRef = useRef<HTMLDivElement>(null);

  // "Show more" pressed from the keyboard: once the page is in, the keys go on from its newest changeset.
  const [landing, setLanding] = useState<{ countBefore: number; started: boolean } | null>(null);
  const loading = older?.loading ?? false;
  useEffect(() => {
    if (!landing) return;
    if (loading && !landing.started) {
      setLanding({ ...landing, started: true });
      return;
    }
    const next = showMoreLanding({ ...landing, count: changesets.length, loading });
    if (next.kind === 'wait') return;
    setLanding(null);
    if (next.kind === 'cancel') return;
    const key = String(changesets[next.index]!.id);
    list.select(singleSelection(key), key);
    if (showMoreRef.current) focusMainNear(showMoreRef.current);
  }, [landing, loading, changesets.length]); // As the read goes, not on every render.
  const showMore = (fromKeyboard: boolean): void => {
    if (fromKeyboard) setLanding({ countBefore: changesets.length, started: false });
    older?.onShowMore();
  };
  const showMoreKey = showMoreBeforeKey(list.shown, more);

  return (
    <ChangesetFold
      allChanges={ALL_INCOMING_ROW}
      selected={list.choice.kind === 'all'}
      onSelectAll={onSelectAll}
      foldLabel={changesetFoldLabel(open)}
      open={open}
      onToggle={onToggle}
    >
      <div ref={showMoreRef}>
        <ChangesetStepList
          list={list}
          allChanges={ALL_INCOMING_ROW}
          separator={older && showMoreKey ? { beforeKey: showMoreKey, content: <IncomingShowMore loading={older.loading} onShowMore={showMore} /> } : undefined}
          mostRows={CHANGESET_LIST_MOST_ROWS}
          label="Incoming changesets"
          contextMenu={changesetMenu}
        />
      </div>
    </ChangesetFold>
  );
}
