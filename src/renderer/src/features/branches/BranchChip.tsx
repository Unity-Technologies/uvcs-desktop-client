import { GitBranch } from 'lucide-react';
import { PathLabel } from '../../components/PathLabel';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import styles from './BranchChip.module.css';

interface BranchChipProps {
  name: string;
  /** Where clicking goes, e.g. selecting the branch in the graph; by default the Branch Explorer, revealing the branch. */
  onSelect?: (name: string) => void;
}

/** A branch in a details panel's meta row, going to it when clicked. */
export function BranchChip({ name, onSelect }: BranchChipProps) {
  const select = onSelect ?? ((branch: string) => showInBranchExplorer({ kind: 'branch', name: branch }));
  return (
    <button className={styles.chip} onClick={() => select(name)} data-tip={onSelect ? name : `Show ${name} in the Branch Explorer`}>
      <GitBranch size={12} className={styles.icon} />
      <PathLabel path={name} fitContent tooltip={false} />
    </button>
  );
}
