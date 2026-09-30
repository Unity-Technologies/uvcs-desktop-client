import { Check, ChevronDown, Focus, X } from 'lucide-react';
import type { MenuEntry } from '../../lib/actions';
import { hotkey } from '../../lib/shortcutRegistry';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import type { GraphFocus } from './model/filterGraph';
import styles from './FocusChip.module.css';

const FOCUS_HOPS: { hops: number; label: string }[] = [
  { hops: 1, label: 'Direct relatives' },
  { hops: 2, label: 'Extended family · 2 hops' },
  { hops: 3, label: 'Neighborhood · 3 hops' },
];

interface FocusChipProps {
  focus: GraphFocus;
  onHopsChange: (hops: number) => void;
  onExit: () => void;
}

/**
 * With the filters, a pill telling that the graph is focused on a branch's relatives: the branch and how far the
 * focus reaches (which opens the choice of reach), then the way out, both in one pill.
 */
export function FocusChip({ focus, onHopsChange, onExit }: FocusChipProps) {
  const entries: MenuEntry[] = FOCUS_HOPS.map((option) => ({
    id: `hops.${option.hops}`,
    label: option.label,
    icon: option.hops === focus.hops ? Check : undefined,
    run: () => onHopsChange(option.hops),
  }));

  return (
    <div className={styles.focusChip}>
      <ActionDropdownMenu entries={entries} align="start">
        <button type="button" className={styles.focusSeed} data-tip="Branches related to this one">
          <Focus size={13} className={styles.focusIcon} />
          {focus.branch}
          <span className={styles.filterValue}>{focus.hops === 1 ? '1 hop' : `${focus.hops} hops`}</span>
          <ChevronDown size={12} className={styles.filterChevron} />
        </button>
      </ActionDropdownMenu>
      <button type="button" className={styles.focusExit} onClick={onExit} aria-label="Show all branches" data-tip="Show all branches" data-tip-shortcut={hotkey('graphClear')}>
        <X size={12} />
      </button>
    </div>
  );
}
