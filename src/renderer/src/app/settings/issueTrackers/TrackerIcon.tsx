import { CircleDot } from 'lucide-react';
import type { IssueTrackerKind } from '@shared/domain/issueTrackers';
import { choiceOf } from './trackerChoices';
import { TrackerLogo } from './TrackerLogo';
import styles from './IssueTrackerPane.module.css';

/** A tracker's logo (`TrackerLogo`); with no tracker yet, a neutral issue glyph on a soft tile. */
export function TrackerIcon({ kind, size = 30 }: { kind: IssueTrackerKind | null; size?: number }) {
  if (kind) return <TrackerLogo choice={choiceOf(kind)} size={size} />;
  return (
    <span className={styles.tile} style={{ width: size, height: size }} aria-hidden>
      <CircleDot size={Math.round(size * 0.53)} strokeWidth={2} />
    </span>
  );
}
