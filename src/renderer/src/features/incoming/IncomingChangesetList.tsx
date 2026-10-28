import { CommentLine } from '../../components/comments/CommentLine';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, GitCommitVertical, Layers } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import type { MenuEntry } from '../../lib/actions';
import { navigationTarget } from '../../lib/listNavigation';
import { firstLine, formatCountAtLeast } from '../../lib/text';
import { Avatar } from '../../ui/Avatar';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { RelativeTime } from '../../ui/RelativeTime';
import { ALL_ROW_HEIGHT, CHANGESET_ROW_HEIGHT, changesetListMaxHeight, changesetsSummary } from './incomingChangesetSection';
import { ALL_INCOMING, scopeKey, type IncomingScope } from './incomingScope';
import { IncomingShowMore } from './IncomingShowMore';
import { showMoreLanding } from './showMoreLanding';
import styles from './IncomingChangesetList.module.css';


interface IncomingChangesetListProps {
  changesets: Changeset[];
  /** Older changesets remain to be read: the counts say "200+". */
  more: boolean;
  scope: IncomingScope;
  onScope: (scope: IncomingScope) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  changesetMenu: (changeset: Changeset) => MenuEntry[];
  /** Older changesets remain to be read: "Show more" after the last one reads the next page. */
  older?: { loading: boolean; onShowMore: () => void };
}

/**
 * The incoming changesets, to see what one of them changed, under "All incoming changes", which shows the whole
 * update. Each row is what the list of changesets read (comment, author, date): nothing is asked of `cm` per row.
 * The files below are what Incoming is for: the section shows a few changesets and scrolls the rest
 * (`changesetListMaxHeight`), and closed, its header sums them up (`changesetsSummary`). Hundreds of changesets: only
 * the rows in view render.
 */
export function IncomingChangesetList({ changesets, more, scope, onScope, collapsed, onToggleCollapsed, changesetMenu, older }: IncomingChangesetListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const scopes: IncomingScope[] = [ALL_INCOMING, ...changesets.map((changeset): IncomingScope => ({ kind: 'changeset', id: changeset.id }))];
  const virtualizer = useVirtualizer({
    count: scopes.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (index) => (index === 0 ? ALL_ROW_HEIGHT : CHANGESET_ROW_HEIGHT),
    getItemKey: (index) => scopeKey(scopes[index]!),
    overscan: 12,
  });
  const idPrefix = useId();
  const listId = `${idPrefix}-list`;
  const selectedIndex = scopes.findIndex((each) => scopeKey(each) === scopeKey(scope));

  const onKeyDown = (event: KeyboardEvent): void => {
    const ends: Record<string, number> = { Home: 0, End: scopes.length - 1 };
    const target = ends[event.key] ?? navigationTarget(event.key, selectedIndex, scopes.length);
    if (target === null || target === undefined) return;
    event.preventDefault();
    onScope(scopes[target]!);
    virtualizer.scrollToIndex(target);
  };

  // "Show more" pressed from the keyboard: once the page is in, the arrows go on from its first changeset.
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
    onScope(scopes[next.index]!);
    virtualizer.scrollToIndex(next.index);
    listboxRef.current?.focus({ preventScroll: true });
  }, [landing, loading, changesets.length]); // As the read goes, not on every render.
  const showMore = (fromKeyboard: boolean): void => {
    if (fromKeyboard) setLanding({ countBefore: changesets.length, started: false });
    older?.onShowMore();
  };

  const changesetRow = (changeset: Changeset, index: number) => (
    <ActionContextMenu entries={() => changesetMenu(changeset)}>
      <button
        id={`${idPrefix}-${index}`}
        role="option"
        aria-selected={index === selectedIndex}
        tabIndex={-1}
        className={styles.changeset}
        data-selected={index === selectedIndex}
        onClick={() => onScope({ kind: 'changeset', id: changeset.id })}
      >
        <GitCommitVertical size={14} className={styles.icon} />
        <span className={styles.text}>
          <span className={styles.comment}>{firstLine(changeset.comment) ? <CommentLine comment={changeset.comment} interactive={false} /> : 'No comment'}</span>
          <span className={styles.meta}>
            <Avatar user={changeset.owner} size={14} />
            cs:{changeset.id} · <RelativeTime date={changeset.date} />
          </span>
        </span>
      </button>
    </ActionContextMenu>
  );

  const allRow = (
    <button
      id={`${idPrefix}-0`}
      role="option"
      aria-selected={selectedIndex === 0}
      tabIndex={-1}
      className={styles.all}
      data-selected={selectedIndex === 0}
      onClick={() => onScope(ALL_INCOMING)}
    >
      <Layers size={14} className={styles.icon} />
      <span className={styles.comment}>All incoming changes</span>
    </button>
  );

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
        <div ref={viewportRef} id={listId} className={styles.list} style={{ maxHeight: changesetListMaxHeight() }}>
          <div
            ref={listboxRef}
            className={styles.rows}
            style={{ height: virtualizer.getTotalSize() }}
            tabIndex={0}
            role="listbox"
            aria-label="Incoming changesets"
            aria-activedescendant={selectedIndex === -1 ? undefined : `${idPrefix}-${selectedIndex}`}
            onKeyDown={onKeyDown}
            // Focus lands on the rows, as tall as all of them: the browser scrolls to their top, so bring back the one selected.
            onFocus={() => selectedIndex !== -1 && virtualizer.scrollToIndex(selectedIndex)}
          >
            {virtualizer.getVirtualItems().map((item) => (
              <div key={item.key} ref={virtualizer.measureElement} data-index={item.index} role="presentation" className={styles.slot} style={{ transform: `translateY(${item.start}px)` }}>
                {item.index === 0 ? allRow : changesetRow(changesets[item.index - 1]!, item.index)}
              </div>
            ))}
          </div>
          {/* After the listbox, not in it: its keys stay its own, and Tab reaches it. */}
          {older && <IncomingShowMore loading={older.loading} onShowMore={showMore} />}
        </div>
      )}
    </section>
  );
}
