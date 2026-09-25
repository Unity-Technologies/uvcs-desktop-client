import { GitCommitVertical } from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import type { DiffEntry, DiffStatus } from '@shared/domain/diff';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge, type StatusTone } from '../../components/StatusBadge';
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

  const fileRow = (file: DiffEntry) => (
    <button key={file.path} className={styles.row} data-selected={isSelectedFile(file.path)} onClick={() => onSelect({ kind: 'file', path: file.path })}>
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
    <div className={styles.list}>
      {conflicting.length > 0 && (
        <Section label="Changed on both sides" count={conflicting.length}>
          {conflicting.map(fileRow)}
        </Section>
      )}
      <Section label="Changesets" count={changesets.length}>
        {changesets.map((changeset) => (
          <button
            key={changeset.id}
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

function Section({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span>{label}</span>
        <span className={styles.count}>{count}</span>
      </div>
      {children}
    </section>
  );
}
