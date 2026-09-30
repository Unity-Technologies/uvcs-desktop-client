import { useQuery } from '@tanstack/react-query';
import { CircleX, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { hotkey, hotkeys } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ToggleChip } from '../../ui/ToggleChip';
import { cmVersionQuery } from '../startup/useCmAvailability';
import { useWorkspacePath } from '../workspace/useWorkspace';
import { CommandLogEntryRow } from './CommandLogEntryRow';
import { commandLogRows, isFiltering, NO_FILTER } from './commandLogFilter';
import { numberDigits } from './commandLogNumbering';
import { ranInWorkspace, type CommandLogScope } from './commandLogScope';
import { useCommandLogStore } from './commandLogStore';
import styles from './CommandLogPanel.module.css';

const SCOPES: { value: CommandLogScope; label: string; title: string }[] = [
  { value: 'workspace', label: 'This workspace', title: 'Commands that ran in this workspace' },
  { value: 'all', label: 'All', title: 'Every command the app ran, including lookups of other workspaces and servers' },
];

export function CommandLogPanel() {
  const entries = useCommandLogStore((state) => state.entries);
  const firstNumber = useCommandLogStore((state) => state.firstNumber);
  const revealedId = useCommandLogStore((state) => state.revealedId);
  const scope = useCommandLogStore((state) => state.scope);
  const filter = useCommandLogStore((state) => state.filter);
  const { setScope, setFilter, clear, toggle } = useCommandLogStore.getState();
  const workspacePath = useWorkspacePath();
  // Asked once at start (`prefetchStartupQueries`): showing it runs no command.
  const { data: cmVersion } = useQuery(cmVersionQuery);
  const listRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const log = useMemo(() => ({ entries, firstNumber }), [entries, firstNumber]);
  const rows = useMemo(() => commandLogRows(log, scope, workspacePath, filter), [log, scope, workspacePath, filter]);

  // The entry asked for shows even if the filter or the scope hid it; only when asked, so filtering can hide it again.
  useEffect(() => {
    const revealed = revealedId === null || rows.some((row) => row.entry.id === revealedId) ? undefined : entries.find((entry) => entry.id === revealedId);
    if (!revealed) return;
    setFilter(NO_FILTER);
    if (!ranInWorkspace(revealed, workspacePath)) setScope('all');
  }, [revealedId]);

  useEffect(() => {
    const revealed = revealedId !== null && listRef.current?.querySelector(`[data-entry-id="${revealedId}"]`);
    if (revealed) revealed.scrollIntoView({ block: 'center' });
    else listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [rows.length, revealedId]);

  const focusFilter = (event: KeyboardEvent): void => {
    const key = hotkeys('commandLogFilter').find((candidate) => matchesShortcut(event.nativeEvent, candidate));
    // In the field, the plain key is typed.
    if (!key || (event.target === filterRef.current && key !== hotkey('commandLogFilter'))) return;
    event.preventDefault();
    event.stopPropagation();
    filterRef.current?.focus();
    filterRef.current?.select();
  };

  return (
    // Focusable, so a click in the log keeps the keys (⌘F) in it.
    <section className={styles.panel} tabIndex={-1} onKeyDown={focusFilter}>
      <header className={styles.header}>
        <span className={styles.title}>Command log</span>
        <span className={styles.count}>{pluralize(rows.length, 'command')}</span>
        {cmVersion && (
          <span className={`${styles.version} selectable`} data-tip="The version of cm the app runs">
            · cm {cmVersion}
          </span>
        )}
        <div className={styles.spacer} />
        <SearchField ref={filterRef} value={filter.query} onChange={(query) => setFilter({ query })} placeholder="Filter commands" width={200} />
        <ToggleChip pressed={filter.failedOnly} icon={<CircleX size={13} />} onChange={(failedOnly) => setFilter({ failedOnly })}>
          Failed
        </ToggleChip>
        <SegmentedControl value={scope} segments={SCOPES} onChange={setScope} />
        <IconButton size="small" icon={<Trash2 size={13} />} label="Clear" onClick={clear} />
        <IconButton size="small" icon={<X size={14} />} label="Close" onClick={toggle} />
      </header>
      <div ref={listRef} className={`${styles.list} selectable`} style={{ '--number-digits': numberDigits(log) } as CSSProperties}>
        <HighlightQuery query={filter.query}>
          {rows.map((row) => (
            <CommandLogEntryRow key={row.entry.id} entry={row.entry} number={row.number} revealed={row.entry.id === revealedId} cwd={row.cwd} />
          ))}
        </HighlightQuery>
        {rows.length === 0 && isFiltering(filter) && (
          <div className={styles.empty}>
            No commands match
            <Button size="small" variant="ghost" onClick={() => setFilter(NO_FILTER)}>
              Clear filter
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
