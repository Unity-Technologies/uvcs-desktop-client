import { Check, ChevronRight, EyeOff, GitBranch } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { PathLabel } from '../../components/PathLabel';
import { textMeasurer } from '../../lib/measureText';
import { CodeReviewChip } from '../codeReviews/CodeReviewChip';
import type { BranchTreeRow } from './branchTree';
import { chipsFit } from './chipsFit';
import styles from './BranchesView.module.css';

const INDENT = 16;
const GAP = 6;
const ICON = 13;

interface BranchNameCellProps {
  row: BranchTreeRow;
  isCurrent: boolean;
  /** The branch's newest code review, if it has one. */
  review: CodeReviewSummary | undefined;
  onToggleCollapsed: (name: string) => void;
}

/**
 * Every row reads the same: the branch as a path (parents dimmed, dropped from the middle when short of room; just the
 * leaf under its parent in the tree), then its chips. The name comes first: chips give up their text, keeping their
 * icons, before the name is trimmed, and are never cut.
 */
export function BranchNameCell({ row, isCurrent, review, onToggleCollapsed }: BranchNameCellProps) {
  const { branch } = row;
  const shownName = row.depth > 0 ? branch.name.slice(branch.name.lastIndexOf('/') + 1) : branch.name;
  const ref = useRef<HTMLSpanElement>(null);
  const compact = useCompactChips(ref, shownName, row.depth * INDENT, `${isCurrent}:${review?.status}:${branch.isHidden}`);

  return (
    <span ref={ref} className={styles.name} style={{ paddingLeft: row.depth * INDENT }}>
      {row.hasChildren ? (
        <button
          className={styles.chevron}
          data-collapsed={row.collapsed}
          aria-label={row.collapsed ? 'Expand' : 'Collapse'}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => onToggleCollapsed(branch.name)}
        >
          <ChevronRight size={ICON} />
        </button>
      ) : (
        <GitBranch size={ICON} className={styles.branchIcon} />
      )}
      <span className={styles.label} data-hidden={branch.isHidden}>
        <PathLabel path={shownName} fitContent />
      </span>
      {isCurrent && (
        <span className={styles.current} data-chip data-compact={compact} data-tip={compact ? 'Current branch' : undefined}>
          {compact ? <Check size={10} /> : 'Current'}
        </span>
      )}
      {review && (
        <span className={styles.chip} data-chip>
          <CodeReviewChip review={review} iconOnly={compact} />
        </span>
      )}
      {branch.isHidden && <EyeOff size={12} className={styles.hiddenIcon} data-chip data-tip="Hidden branch" />}
    </span>
  );
}

/**
 * Whether the chips should show only their icons: the whole name and the chips with their text don't fit. The widths of
 * the chips with text are measured while they show it (rows start that way) and kept for the resizes that follow.
 */
function useCompactChips(ref: RefObject<HTMLSpanElement | null>, name: string, indent: number, chips: string): boolean {
  const [compact, setCompact] = useState(false);
  const compactNow = useRef(compact);
  compactNow.current = compact;
  const fullChipWidths = useRef<number[]>([]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = (): void => {
      const shown = [...element.querySelectorAll<HTMLElement>('[data-chip]')];
      if (shown.length === 0) return;
      if (!compactNow.current || shown.length !== fullChipWidths.current.length) fullChipWidths.current = shown.map((chip) => chip.getBoundingClientRect().width);
      const nameWidth = ICON + GAP + Math.ceil(textMeasurer(element, '500')(name)) + 1;
      setCompact(!chipsFit({ available: element.clientWidth - indent, nameWidth, chipWidths: fullChipWidths.current, gap: GAP }));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, name, indent, chips]);

  return compact;
}
