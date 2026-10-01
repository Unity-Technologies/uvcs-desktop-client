import type { PathMove } from '../ui/followTip';
import { moveTipAttributes } from '../ui/tipAttributes';
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

/** A small colored letter describing what happened to a file, as in the Plastic desktop GUI; a moved one's tooltip can show the move. */
export function StatusBadge({ tone, title, letter, move }: { tone: StatusTone; title: string; letter?: string; move?: PathMove }) {
  return (
    <span className={styles.badge} data-tone={tone} data-tip={title} {...moveTipAttributes(move)}>
      <StatusLetter letter={letter ?? STATUS_LETTERS[tone]} />
    </span>
  );
}

/** A status letter trimmed to its cap height, so it sits in the optical center of whatever box holds it. */
export function StatusLetter({ letter }: { letter: string }) {
  return <span className={styles.letter}>{letter}</span>;
}
