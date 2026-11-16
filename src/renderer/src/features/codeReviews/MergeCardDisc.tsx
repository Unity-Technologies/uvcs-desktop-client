import { Check, CircleDot, X, type LucideIcon } from 'lucide-react';
import type { MergeCardSection, MergeCardTone } from './mergeCard';
import { MERGE_REQUEST_STATE_ICONS } from './mergeRequestState';
import stateColors from './mergeRequestStateColors.module.css';
import styles from './MergeCardDisc.module.css';

const TONE_ICONS: Record<MergeCardTone, LucideIcon> = { passed: Check, failed: X, pending: CircleDot, neutral: CircleDot };

/**
 * What leads a merge card's section: the state's glyph in its color for a section that is the state; else the tone's
 * check, cross or dot. `small` in a hover card (`MergeRequestSummaryCard`).
 */
export function MergeCardDisc({ section, size = 'regular' }: { section: Pick<MergeCardSection, 'tone' | 'state'>; size?: 'regular' | 'small' }) {
  const iconSize = size === 'small' ? 13 : 16;
  if (section.state) {
    const Icon = MERGE_REQUEST_STATE_ICONS[section.state];
    return (
      <span className={`${styles.disc} ${stateColors.stateColor}`} data-state={section.state} data-size={size}>
        <Icon size={iconSize} aria-hidden />
      </span>
    );
  }
  const Icon = TONE_ICONS[section.tone];
  return (
    <span className={styles.disc} data-tone={section.tone} data-size={size}>
      <Icon size={iconSize} aria-hidden />
    </span>
  );
}
