import { UserMinus, UserPlus } from 'lucide-react';
import { forwardRef, useId, useState, type KeyboardEvent } from 'react';
import { navigationTarget } from '../../lib/listNavigation';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { hotkey, hotkeys } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import { MemberIcon } from './MemberIcon';
import { memberStatus, type MemberRow } from './members';
import styles from './PermissionsDialog.module.css';

/** Past this many entries the list gets a filter. */
const FILTER_FROM = 8;

interface MemberListProps {
  rows: MemberRow[];
  selected: string | undefined;
  onSelect: (name: string) => void;
  onAdd: () => void;
  onRemove: (row: MemberRow) => void;
  /** Why a row can't be removed, if it can't. */
  removeReason: (row: MemberRow) => string | undefined;
}

/** The users and groups with an entry here or above: ↑ ↓ pick one, the remove shortcut removes its entry here. */
export const MemberList = forwardRef<HTMLDivElement, MemberListProps>(function MemberList({ rows, selected, onSelect, onAdd, onRemove, removeReason }, ref) {
  const listId = useId();
  const [filter, setFilter] = useState('');
  const shown = rows.filter((row) => matchesWordFilter([row.label], filter));
  const selectedRow = rows.find((row) => row.member.name === selected);
  const reason = selectedRow ? removeReason(selectedRow) : 'Pick a user or group';
  const index = shown.findIndex((row) => row.member.name === selected);
  const optionId = (name: string) => `${listId}-${encodeURIComponent(name)}`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (selectedRow && hotkeys('removeMember').some((key) => matchesShortcut(event, key))) {
      event.preventDefault();
      if (!reason) onRemove(selectedRow);
      return;
    }
    const next = navigationTarget(event.key, Math.max(0, index), shown.length);
    if (next === null) return;
    event.preventDefault();
    onSelect(shown[next]!.member.name);
    document.getElementById(optionId(shown[next]!.member.name))?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <section className={styles.members} aria-label="Users and groups">
      <header className={styles.paneHeader}>
        <h3 className={styles.paneTitle}>Users and groups</h3>
        <IconButton icon={<UserPlus size={15} />} label="Add a user or group…" size="small" onClick={onAdd} />
        <IconButton
          icon={<UserMinus size={15} />}
          label={reason ?? `Remove ${selectedRow?.label} from here`}
          shortcut={reason ? undefined : hotkey('removeMember')}
          size="small"
          disabled={Boolean(reason)}
          onClick={() => selectedRow && onRemove(selectedRow)}
        />
      </header>
      {rows.length > FILTER_FROM && <SearchField value={filter} onChange={setFilter} placeholder="Filter users and groups" width="100%" />}
      <HighlightQuery query={filter}>
        <div
          ref={ref}
          role="listbox"
          aria-label="Users and groups"
          tabIndex={0}
          aria-activedescendant={selected && index >= 0 ? optionId(selected) : undefined}
          className={styles.memberList}
          onKeyDown={onKeyDown}
        >
          {shown.map((row) => (
            <div
              key={row.member.name}
              id={optionId(row.member.name)}
              role="option"
              aria-selected={row.member.name === selected}
              className={styles.member}
              data-selected={row.member.name === selected}
              onMouseDown={() => onSelect(row.member.name)}
            >
              <MemberIcon name={row.member.name} role={row.role} size={24} />
              <span className={styles.memberText}>
                <span className={styles.memberName}>
                  <Highlight text={row.label} />
                </span>
                <span className={styles.memberStatus}>{memberStatus(row)}</span>
              </span>
              {row.changed && <span className={styles.changedDot} data-tip="Changed, not saved yet" />}
            </div>
          ))}
          {shown.length === 0 && <p className={styles.emptyNote}>No matching users or groups</p>}
        </div>
      </HighlightQuery>
    </section>
  );
});
