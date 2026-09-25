import styles from './StatusBadge.module.css';

export type StatusTone = 'added' | 'changed' | 'deleted' | 'moved' | 'permissions' | 'private' | 'conflict' | 'muted';

export const STATUS_LETTERS: Record<StatusTone, string> = {
  added: 'A',
  changed: 'C',
  deleted: 'D',
  moved: 'M',
  permissions: 'FS',
  private: 'P',
  conflict: '!',
  muted: '·',
};

/** A small colored letter describing what happened to a file, as in the Plastic desktop GUI. */
export function StatusBadge({ tone, title, letter }: { tone: StatusTone; title: string; letter?: string }) {
  return (
    <span className={styles.badge} data-tone={tone} title={title}>
      {letter ?? STATUS_LETTERS[tone]}
    </span>
  );
}
