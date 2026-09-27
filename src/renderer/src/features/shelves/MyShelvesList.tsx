import { MoreHorizontal } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Shelve } from '@shared/domain/shelve';
import { navigation } from '../../app/navigation/navigationStore';
import { useSettings } from '../../app/settings/useSettings';
import { runningFirst, withoutAction } from '../../lib/actions';
import { sincePresetLabel } from '../../lib/sincePresets';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { SearchField } from '../../ui/SearchField';
import { Spinner } from '../../ui/Spinner';
import { matchesShelveFilter, myShelves, withFoundShelves } from './myShelves';
import { shelveMenu } from './shelveMenu';
import { applyShelve, showShelveChanges } from './shelveOperations';
import { MY_SHELVES_SINCE, useMyShelvesSearch } from './useMyShelves';
import styles from './MyShelvesList.module.css';

interface MyShelvesListProps {
  workspacePath: string;
  /** The user's recent shelves (`useMyShelves`). */
  recent: Shelve[];
  /** Closes the popover: every action here goes on without it on top. */
  onDone: () => void;
}

/**
 * The user's shelves in Changes, filtered as the user types (older ones too, found on the server): a row per shelve
 * opens its diff; Apply (Restore for changes a switch left) merges it here, and the rest of its actions are behind
 * "More actions". ↑↓ move between the filter and the rows.
 */
export function MyShelvesList({ workspacePath, recent, onDone }: MyShelvesListProps) {
  const { switchShelves } = useSettings();
  const [filter, setFilter] = useState('');
  const { data: found, isFetching: searching } = useMyShelvesSearch(filter);
  const listRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const since = sincePresetLabel(MY_SHELVES_SINCE).toLowerCase();

  const rows = useMemo(() => {
    const shelves = filter.trim() && found ? withFoundShelves(recent, found) : recent;
    return myShelves(shelves, switchShelves).filter((row) => matchesShelveFilter(row, filter));
  }, [recent, found, filter, switchShelves]);

  const moveFocus = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const rowButtons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[data-shelve-row]') ?? [])];
    const current = rowButtons.findIndex((row) => row.parentElement?.contains(document.activeElement));
    const next = event.key === 'ArrowDown' ? rowButtons[current + 1] : current <= 0 ? filterRef.current : rowButtons[current - 1];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  return (
    <div className={styles.container} onKeyDown={moveFocus}>
      <div className={styles.header}>
        <SearchField ref={filterRef} value={filter} onChange={setFilter} placeholder="Filter your shelves" width="100%" autoFocus />
        {searching && <Spinner size={12} />}
        <Button
          size="small"
          variant="ghost"
          className={styles.all}
          onClick={() => {
            onDone();
            navigation.goToView('shelves');
          }}
        >
          All shelves
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className={styles.empty}>{filter.trim() ? 'None of your shelves match.' : `No shelves from the ${since}.`}</div>
      ) : (
        <ul ref={listRef} className={styles.list} aria-label="Your shelves">
          {rows.map(({ shelve, title, detail, left }) => (
            <li key={shelve.id} className={styles.row}>
              <button
                type="button"
                className={styles.open}
                data-shelve-row
                data-tip={left ? 'Show the changes left here' : 'Show the shelved changes'}
                onClick={() => {
                  onDone();
                  showShelveChanges(shelve);
                }}
              >
                <span className={styles.title}>{title}</span>
                <span className={styles.detail}>{detail}</span>
              </button>
              <Button
                size="small"
                data-tip={left ? 'Apply the changes and delete the shelve' : 'Merge the shelved changes here; the shelve stays'}
                onClick={() => {
                  onDone();
                  void applyShelve(workspacePath, shelve.id, left);
                }}
              >
                {left ? 'Restore' : 'Apply'}
              </Button>
              <ActionDropdownMenu entries={runningFirst(withoutAction(shelveMenu(workspacePath, [shelve], { left }), 'apply'), onDone, ['copy'])}>
                <IconButton size="small" icon={<MoreHorizontal size={14} />} label="More actions" />
              </ActionDropdownMenu>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
