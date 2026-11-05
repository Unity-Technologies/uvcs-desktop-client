import { CircleDot, SquareKanban } from 'lucide-react';
import type { IssueTrackerKind } from '@shared/domain/issueTrackers';
import styles from './IssueTrackerPane.module.css';

/** A tracker's mark on its soft tile: a board for Jira, an issue for GitHub; neutral glyphs, never a brand's. */
export function TrackerIcon({ kind, size = 16 }: { kind: IssueTrackerKind | null; size?: number }) {
  const Glyph = kind === 'github' ? CircleDot : SquareKanban;
  return (
    <span className={styles.tile} aria-hidden>
      <Glyph size={size} strokeWidth={2} />
    </span>
  );
}
