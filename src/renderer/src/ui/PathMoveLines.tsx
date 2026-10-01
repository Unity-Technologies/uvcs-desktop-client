import { Fragment } from 'react';
import { pathChangeSegments, type PathPart } from '../lib/pathChangeSegments';
import type { PathMove } from './followTip';
import styles from './PathMoveLines.module.css';

/**
 * A move as two lines, where the item was over where it is now, the folders and name the move changed marked in each
 * (`pathChangeSegments`): removed ones in the old path, added ones in the new, in the diff's colors. Long paths wrap
 * after a separator rather than overflow.
 */
export function PathMoveLines({ move }: { move: PathMove }) {
  const change = pathChangeSegments(move.from, move.to);
  return (
    <div className={styles.lines}>
      <span className={styles.word}>from</span>
      <PathParts parts={change.old} change="removed" />
      <span className={styles.word}>to</span>
      <PathParts parts={change.new} change="added" />
    </div>
  );
}

function PathParts({ parts, change }: { parts: PathPart[]; change: 'removed' | 'added' }) {
  return (
    <span className={styles.path}>
      {parts.map((part, index) => (
        <span key={index} className={part.changed ? styles.changed : undefined} data-change={part.changed ? change : undefined}>
          <BreakableAfterSeparators text={part.text} />
        </span>
      ))}
    </span>
  );
}

/** The text with a line break allowed after each separator, so a long path wraps between folders. */
function BreakableAfterSeparators({ text }: { text: string }) {
  return text.split(/(?<=[/\\])/).map((piece, index) => (
    <Fragment key={index}>
      {index > 0 && <wbr />}
      {piece}
    </Fragment>
  ));
}
