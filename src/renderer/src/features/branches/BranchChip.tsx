import { GitBranch } from 'lucide-react';
import { PathLabel } from '../../components/PathLabel';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import styles from './BranchChip.module.css';

interface BranchChipProps {
  name: string;
  /** Where clicking goes, e.g. selecting the branch in the graph; by default the Branch Explorer, revealing the branch. */
  onSelect?: (name: string) => void;
  /**
   * The repository the branch is in when it isn't the workspace's (an item under an xlink): the chip only names it, as
   * the Branch Explorer shows the workspace's repository, whose branch of that name is another one.
   */
  otherRepository?: string;
}

/** A branch in a details panel's meta row, going to it when clicked. */
export function BranchChip({ name, onSelect, otherRepository }: BranchChipProps) {
  const content = (
    <>
      <GitBranch size={12} className={styles.icon} />
      <PathLabel path={name} fitContent tooltip={false} />
    </>
  );
  if (otherRepository) {
    return (
      <span className={styles.chip} data-inert data-tip={`${name} in ${otherRepository}`}>
        {content}
      </span>
    );
  }
  const select = onSelect ?? ((branch: string) => showInBranchExplorer({ kind: 'branch', name: branch }));
  return (
    <button className={styles.chip} onClick={() => select(name)} data-tip={onSelect ? name : `Show ${name} in the Branch Explorer`}>
      {content}
    </button>
  );
}
