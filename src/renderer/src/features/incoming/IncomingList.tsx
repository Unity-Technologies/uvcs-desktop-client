import { GitCommitVertical } from 'lucide-react';
import { useId, type KeyboardEvent } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import type { DiffEntry, DiffStatus } from '@shared/domain/diff';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge, type StatusTone } from '../../components/StatusBadge';
import { navigationTarget } from '../../lib/listNavigation';
import { MAIN_FOCUS } from '../../lib/mainFocus';
import { Avatar } from '../../ui/Avatar';
import { RelativeTime } from '../../ui/RelativeTime';
import styles from './IncomingList.module.css';

const TONES: Record<DiffStatus, StatusTone> = { added: 'added', changed: 'changed', deleted: 'deleted', moved: 'moved' };

export type IncomingSelection = { kind: 'changeset'; id: number } | { kind: 'file'; path: string };

interface IncomingListProps {
  changesets: Changeset[];
  files: DiffEntry[];
  /** Paths that changed locally too; resolved ones are no longer pending. */
  conflictPaths: ReadonlySet<string>;
  pendingConflictPaths: ReadonlySet<string>;
  selection: IncomingSelection | null;
  onSelect: (selection: IncomingSelection) => void;
}

export function IncomingList({ changesets, files, conflictPaths, pendingConflictPaths, selection, onSelect }: IncomingListProps) {
  const conflicting = files.filter((file) => conflictPaths.has(file.path));
  const others = files.filter((file) => !conflictPaths.has(file.path));
  const isSelectedFile = (path: string): boolean => selection?.kind === 'file' && selection.path === path;
  const idPrefix = useId();
  // In the order shown, for the arrows.
  const entries: IncomingSelection[] = [
    ...conflicting.map((file) => ({ kind: 'file' as const, path: file.path })),
    ...changesets.map((changeset) => ({ kind: 'changeset' as const, id: changeset.id })),
    ...others.map((file) => ({ kind: 'file' as const, path: file.path })),
  ];
  const optionId = (entry: IncomingSelection): string => `${idPrefix}-${entries.findIndex((candidate) => sameEntry(candidate, entry))}`;
  const selectedIndex = selection ? entries.findIndex((entry) => sameEntry(entry, selection)) : -1;

  const onKeyDown = (event: KeyboardEvent): void => {
    const ends: Record<string, number> = { Home: 0, End: entries.length - 1 };
    const target = ends[event.key] ?? navigationTarget(event.key, selectedIndex, entries.length);
    if (target === null || target === undefined || entries.length === 0) return;
    event.preventDefault();
    onSelect(entries[target]!);
    document.getElementById(optionId(entries[target]!))?.scrollIntoView({ block: 'nearest' });
  };

  const fileRow = (file: DiffEntry) => (
    <button
      key={file.path}
      id={optionId({ kind: 'file', path: file.path })}
      role="option"
      aria-selected={isSelectedFile(file.path)}
      tabIndex={-1}
      className={styles.row}
      data-selected={isSelectedFile(file.path)}
      onClick={() => onSelect({ kind: 'file', path: file.path })}
    >
      {conflictPaths.has(file.path) ? (
        <StatusBadge
          tone={pendingConflictPaths.has(file.path) ? 'conflict' : 'added'}
          title={pendingConflictPaths.has(file.path) ? 'Changed locally too: needs merging' : 'Merged'}
          letter={pendingConflictPaths.has(file.path) ? '!' : '✓'}
        />
      ) : (
        <StatusBadge tone={TONES[file.status]} title={file.status} />
      )}
      <PathLabel path={file.path} oldPath={file.oldPath} strikethrough={file.status === 'deleted'} />
    </button>
  );

  return (
    <div
      className={styles.list}
      tabIndex={0}
      role="listbox"
      aria-label="Incoming changes"
      aria-activedescendant={selectedIndex === -1 ? undefined : `${idPrefix}-${selectedIndex}`}
      onKeyDown={onKeyDown}
      {...MAIN_FOCUS}
    >
      {conflicting.length > 0 && (
        <Section label="Changed on both sides" count={conflicting.length}>
          {conflicting.map(fileRow)}
        </Section>
      )}
      <Section label="Changesets" count={changesets.length}>
        {changesets.map((changeset) => (
          <button
            key={changeset.id}
            id={optionId({ kind: 'changeset', id: changeset.id })}
            role="option"
            aria-selected={selection?.kind === 'changeset' && selection.id === changeset.id}
            tabIndex={-1}
            className={styles.changeset}
            data-selected={selection?.kind === 'changeset' && selection.id === changeset.id}
            onClick={() => onSelect({ kind: 'changeset', id: changeset.id })}
          >
            <GitCommitVertical size={14} className={styles.changesetIcon} />
            <span className={styles.changesetText}>
              <span className={styles.comment}>{changeset.comment || 'No comment'}</span>
              <span className={styles.meta}>
                <Avatar user={changeset.owner} size={14} />
                {changeset.id} · <RelativeTime date={changeset.date} />
              </span>
            </span>
          </button>
        ))}
      </Section>
      {others.length > 0 && (
        <Section label="Files" count={others.length}>
          {others.map(fileRow)}
        </Section>
      )}
    </div>
  );
}

function sameEntry(a: IncomingSelection, b: IncomingSelection): boolean {
  return a.kind === 'file' ? b.kind === 'file' && a.path === b.path : b.kind === 'changeset' && a.id === b.id;
}

function Section({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  const headerId = useId();
  return (
    <section className={styles.section} role="group" aria-labelledby={headerId}>
      <div id={headerId} className={styles.sectionHeader}>
        <span>{label}</span>
        <span className={styles.count}>{count}</span>
      </div>
      {children}
    </section>
  );
}
