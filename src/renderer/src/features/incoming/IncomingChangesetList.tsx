import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { ChangesetStepList } from '../../components/changesetList/ChangesetStepList';
import type { ChangesetStepListState } from '../../components/changesetList/useChangesetStepList';
import type { MenuEntry } from '../../lib/actions';
import { focusMainNear } from '../../lib/mainFocus';
import { singleSelection } from '../../lib/selection';
import { formatCountAtLeast } from '../../lib/text';
import { changesetsSummary, INCOMING_ROWS_SHOWN, showMoreBeforeKey } from './incomingChangesetSection';
import { IncomingShowMore } from './IncomingShowMore';
import { showMoreLanding } from './showMoreLanding';
import styles from './IncomingChangesetList.module.css';

interface IncomingChangesetListProps {
  /** The list's state (`useChangesetStepList`), over the changesets read so far, newest first. */
  list: ChangesetStepListState;
  /** The changesets read so far, newest first. */
  changesets: Changeset[];
  /** Older changesets remain to be read: the counts say "200+". */
  more: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  changesetMenu: (changesets: Changeset[]) => MenuEntry[];
  /** Older changesets remain to be read: "Show more", above the oldest one, reads the next page. */
  older?: { loading: boolean; onShowMore: () => void };
}

const ALL_INCOMING_ROW = { label: 'All incoming changes' };

/**
 * The incoming changesets, to see what some of them changed, under "All incoming changes", which shows the whole
 * update (`ChangesetStepList`, as a branch diff lists its changesets). Each row is what the list of changesets read
 * (comment, author, date): nothing is asked of `cm` per row. The files below are what Incoming is for: the section
 * shows a few changesets and scrolls the rest (`INCOMING_ROWS_SHOWN`), and closed, its header sums them up
 * (`changesetsSummary`).
 */
export function IncomingChangesetList({ list, changesets, more, collapsed, onToggleCollapsed, changesetMenu, older }: IncomingChangesetListProps) {
  const listId = `${useId()}-list`;
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
    <section className={styles.section} data-collapsed={collapsed}>
      <button type="button" className={styles.header} aria-expanded={!collapsed} aria-controls={collapsed ? undefined : listId} onClick={onToggleCollapsed}>
        <ChevronRight size={13} className={styles.chevron} data-collapsed={collapsed} aria-hidden />
        {collapsed ? (
          <span className={styles.title}>{changesetsSummary(changesets, more)}</span>
        ) : (
          <>
            <span className={styles.title}>Changesets</span>
            <span className={styles.count}>{formatCountAtLeast(changesets.length, more)}</span>
          </>
        )}
      </button>
      {!collapsed && (
        <div id={listId} ref={showMoreRef}>
          <ChangesetStepList
            list={list}
            allChanges={ALL_INCOMING_ROW}
            separator={older && showMoreKey ? { beforeKey: showMoreKey, content: <IncomingShowMore loading={older.loading} onShowMore={showMore} /> } : undefined}
            mostRows={INCOMING_ROWS_SHOWN}
            label="Incoming changesets"
            contextMenu={changesetMenu}
          />
        </div>
      )}
    </section>
  );
}
