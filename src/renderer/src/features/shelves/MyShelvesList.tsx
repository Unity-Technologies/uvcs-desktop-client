import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Shelve } from '@shared/domain/shelve';
import { useWorkspaceUser } from '../../app/account/accounts';
import { navigation } from '../../app/navigation/navigationStore';
import { useSettings } from '../../app/settings/useSettings';
import { hotkey } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { Button } from '../../ui/Button';
import { HighlightQuery } from '../../ui/Highlight';
import { SearchField } from '../../ui/SearchField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SkeletonBar, SkeletonRows, skeletonWidth } from '../../ui/Skeleton';
import { Spinner } from '../../ui/Spinner';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { MyShelveRow } from './MyShelveRow';
import { shelvesListRows } from './shelvesListRows';
import { shelvesEmptyMessage, shelvesFilterPlaceholder, type ShelvesScope } from './shelvesScope';
import { useShelvesViewStore } from './shelvesViewStore';
import { useEveryonesShelves, useShelvesSearch } from './useMyShelves';
import styles from './MyShelvesList.module.css';

const ROW_HEIGHT = 44;

interface MyShelvesListProps {
  workspacePath: string;
  scope: ShelvesScope;
  onScopeChange: (scope: ShelvesScope) => void;
  /** The user's recent shelves (`useMyShelves`). */
  recent: Shelve[];
  /** Closes the popover: every action here goes on without it on top. */
  onDone: () => void;
}

/**
 * The shelves in Changes, the user's or everyone's, filtered as the user types (older ones too, found on the server):
 * a row per shelve opens its diff; Apply (Restore for changes a switch left) merges it here, and the rest of its
 * actions are behind "More actions". ↑↓ move between the filter and the rows; ⇧⌘S switches whose shelves show.
 */
export function MyShelvesList({ workspacePath, scope, onScopeChange, recent, onDone }: MyShelvesListProps) {
  const { switchShelves } = useSettings();
  const me = useWorkspaceUser();
  const everyone = useEveryonesShelves(scope === 'everyone');
  const [filter, setFilter] = useState('');
  const { data: found, isFetching: searching } = useShelvesSearch(scope, filter);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const listed = scope === 'mine' ? recent : everyone.data;
  const filtering = filter.trim() !== '';

  const { shown, note } = useMemo(
    () => shelvesListRows({ scope, listed: listed ?? [], found, filter, records: switchShelves, me }),
    [listed, found, filter, switchShelves, scope, me],
  );

  // A row focused in one scope may not be in the other: focus stays in the list, on its first row.
  const shownScope = useRef(scope);
  useEffect(() => {
    if (shownScope.current === scope) return;
    shownScope.current = scope;
    if (containerRef.current?.contains(document.activeElement)) return;
    (listRef.current?.querySelector<HTMLButtonElement>('[data-shelve-row]') ?? filterRef.current)?.focus();
  }, [scope]);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (matchesShortcut(event.nativeEvent, hotkey('shelvesScope'))) {
      // Not the window's ⇧⌘S, which opens the list on the user's own.
      event.preventDefault();
      event.stopPropagation();
      onScopeChange(scope === 'mine' ? 'everyone' : 'mine');
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const rowButtons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[data-shelve-row]') ?? [])];
    const current = rowButtons.findIndex((row) => row.parentElement?.contains(document.activeElement));
    const next = event.key === 'ArrowDown' ? rowButtons[current + 1] : current <= 0 ? filterRef.current : rowButtons[current - 1];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  const openAllShelves = (): void => {
    useShelvesViewStore.getState().update({ people: scope === 'mine' ? MINE : EVERYONE, text: filter.trim() });
    onDone();
    navigation.goToView('shelves');
  };

  return (
    <div ref={containerRef} className={styles.container} onKeyDown={onKeyDown}>
      <div className={styles.header}>
        <SegmentedControl<ShelvesScope>
          label="Whose shelves"
          value={scope}
          onChange={onScopeChange}
          segments={[
            { value: 'mine', label: 'Mine', title: 'Your shelves', shortcut: hotkey('shelvesScope') },
            { value: 'everyone', label: 'Everyone', title: "Everyone's shelves", shortcut: hotkey('shelvesScope') },
          ]}
        />
        <SearchField ref={filterRef} value={filter} onChange={setFilter} placeholder={shelvesFilterPlaceholder(scope)} width="100%" autoFocus />
        {searching && <Spinner size={12} />}
      </div>
      {listed === undefined ? (
        everyone.error ? (
          <div className={styles.empty}>Couldn't load shelves: {everyone.error.message}</div>
        ) : (
          <div className={styles.loading}>
            <SkeletonRows rowHeight={ROW_HEIGHT} rowClassName={styles.skeletonRow}>
              {(index) => (
                <span className={styles.skeletonText}>
                  <SkeletonBar width={skeletonWidth(index)} />
                  <SkeletonBar width={skeletonWidth(index, 1)} />
                </span>
              )}
            </SkeletonRows>
          </div>
        )
      ) : shown.length === 0 ? (
        <div className={styles.empty}>{shelvesEmptyMessage(scope, filtering)}</div>
      ) : (
        <HighlightQuery query={filter}>
          <ul ref={listRef} className={styles.list} aria-label={scope === 'mine' ? 'Your shelves' : "Everyone's shelves"}>
            {shown.map((row) => (
              <MyShelveRow key={row.shelve.id} workspacePath={workspacePath} row={row} onDone={onDone} />
            ))}
          </ul>
        </HighlightQuery>
      )}
      <div className={styles.footer}>
        <span className={styles.note}>{note}</span>
        <Button size="small" variant="ghost" onClick={openAllShelves}>
          All shelves
        </Button>
      </div>
    </div>
  );
}
