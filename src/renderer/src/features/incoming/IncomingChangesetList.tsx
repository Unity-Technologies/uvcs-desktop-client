import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, GitCommitVertical, Layers } from 'lucide-react';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import type { MenuEntry } from '../../lib/actions';
import { navigationTarget } from '../../lib/listNavigation';
import { firstLine, formatCountAtLeast } from '../../lib/text';
import { Avatar } from '../../ui/Avatar';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { RelativeTime } from '../../ui/RelativeTime';
import { ALL_ROW_HEIGHT, CHANGESET_ROW_HEIGHT, changesetListMaxHeight, changesetsSummary } from './incomingChangesetSection';
import { ALL_INCOMING, scopeKey, type IncomingScope } from './incomingScope';
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
  /** After the last changeset, e.g. to read more of them. */
  footer?: ReactNode;
}

/**
 * The incoming changesets, to see what one of them changed, under "All incoming changes", which shows the whole
 * update. Each row is what the list of changesets read (comment, author, date): nothing is asked of `cm` per row.
 * The files below are what Incoming is for: the section shows a few changesets and scrolls the rest
 * (`changesetListMaxHeight`), and closed, its header sums them up (`changesetsSummary`). Hundreds of changesets: only
 * the rows in view render.
 */
export function IncomingChangesetList({ changesets, more, scope, onScope, collapsed, onToggleCollapsed, changesetMenu, footer }: IncomingChangesetListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
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
          <span className={styles.comment}>{firstLine(changeset.comment) || 'No comment'}</span>
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
      <button type="button" className={styles.header} aria-expanded={!collapsed} aria-controls={listId} onClick={onToggleCollapsed}>
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
        <div
          ref={viewportRef}
          id={listId}
          className={styles.list}
          style={{ maxHeight: changesetListMaxHeight() }}
          tabIndex={0}
          role="listbox"
          aria-label="Incoming changesets"
          aria-activedescendant={selectedIndex === -1 ? undefined : `${idPrefix}-${selectedIndex}`}
          onKeyDown={onKeyDown}
        >
          <div className={styles.rows} style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => (
              <div key={item.key} ref={virtualizer.measureElement} data-index={item.index} role="presentation" className={styles.slot} style={{ transform: `translateY(${item.start}px)` }}>
                {item.index === 0 ? allRow : changesetRow(changesets[item.index - 1]!, item.index)}
              </div>
            ))}
          </div>
          {footer}
        </div>
      )}
    </section>
  );
}
