import styles from './StatusBadge.module.css';

export type StatusTone = 'added' | 'changed' | 'deleted' | 'moved' | 'private' | 'conflict' | 'muted';

const LETTERS: Record<StatusTone, string> = {
  added: 'A',
  changed: 'M',
  deleted: 'D',
  moved: 'R',
  private: '?',
  conflict: '!',
  muted: '·',
};

/** A small colored letter describing what happened to a file. */
export function StatusBadge({ tone, title, letter }: { tone: StatusTone; title: string; letter?: string }) {
  return (
    <span className={styles.badge} data-tone={tone} title={title}>
      {letter ?? LETTERS[tone]}
    </span>
  );
}
