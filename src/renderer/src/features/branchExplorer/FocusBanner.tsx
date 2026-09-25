import { Check, ChevronDown, Focus, X } from 'lucide-react';
import type { MenuEntry } from '../../lib/actions';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import type { GraphFocus } from './model/filterGraph';
import styles from './BranchExplorerView.module.css';

const FOCUS_HOPS: { hops: number; label: string }[] = [
  { hops: 1, label: 'Direct relatives' },
  { hops: 2, label: 'Extended family · 2 hops' },
  { hops: 3, label: 'Neighborhood · 3 hops' },
];

interface FocusBannerProps {
  focus: GraphFocus;
  onHopsChange: (hops: number) => void;
  onExit: () => void;
}

/** Tells that the graph is focused on a branch's relatives, how far the focus reaches, and how to leave it. */
export function FocusBanner({ focus, onHopsChange, onExit }: FocusBannerProps) {
  const entries: MenuEntry[] = FOCUS_HOPS.map((option) => ({
    id: `hops.${option.hops}`,
    label: option.label,
    icon: option.hops === focus.hops ? Check : undefined,
    run: () => onHopsChange(option.hops),
  }));
  const current = FOCUS_HOPS.find((option) => option.hops === focus.hops)?.label.split(' · ')[0];

  return (
    <div className={styles.focusBanner}>
      <Focus size={13} className={styles.focusIcon} />
      Branches related to <strong>{focus.branch}</strong>
      <ActionDropdownMenu entries={entries} align="start">
        <button type="button" className={styles.hopsButton}>
          {current}
          <ChevronDown size={12} />
        </button>
      </ActionDropdownMenu>
      <button className={styles.clearFocus} onClick={onExit} aria-label="Show all branches" data-tip="Show all branches" data-tip-shortcut="escape">
        <X size={13} />
      </button>
    </div>
  );
}
