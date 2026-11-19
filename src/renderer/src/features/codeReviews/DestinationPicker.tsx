import { ChevronDown, GitBranch } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { usePlace } from '../../app/workspace/useWorkspace';
import { PathLabel } from '../../components/PathLabel';
import { Popover } from '../../ui/Popover';
import { Spinner } from '../../ui/Spinner';
import { BranchChoiceList } from '../branches/BranchChoiceList';
import { destinationGroups } from './destinationChoices';
import { setMergeRequestDestination } from './mergeRequestOperations';
import styles from './DestinationPicker.module.css';
// The details panel's look is its other branch chip's (`BranchChip`), so the two read as a pair.
import chipStyles from '../branches/BranchChip.module.css';

interface DestinationPickerProps {
  review: Pick<CodeReviewSummary, 'id'>;
  /** The branch the request merges. */
  source: string;
  destination: string;
  /** `headline`: text in the page's headline. `chip`: a branch chip, in a details panel's meta row. */
  look?: 'headline' | 'chip';
}

/**
 * A merge request's destination in its page's headline, or as a chip in its details panel: read as the branch with a
 * small chevron, it opens the branch list
 * (`destinationGroups`: the source's ancestors first, then any branch by typing), and a pick changes it in place. The
 * branches are read only once it opens, the same read the branch switcher shares.
 */
export function DestinationPicker({ review, source, destination, look = 'headline' }: DestinationPickerProps) {
  const place = usePlace();
  const [open, setOpen] = useState(false);
  const [changingTo, setChangingTo] = useState<string>();
  const destinationChoices = useCallback((branches: Branch[]) => destinationGroups(branches, source), [source]);

  const pick = async (branch: Branch): Promise<void> => {
    setOpen(false);
    if (branch.name === destination) return;
    setChangingTo(branch.name);
    await setMergeRequestDestination(place, review, branch.name);
    setChangingTo(undefined);
  };

  return (
    <Popover
      width={420}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button type="button" className={look === 'chip' ? `${chipStyles.chip} ${styles.chip}` : styles.trigger} disabled={changingTo !== undefined} data-tip="Change where it merges" aria-label={`Destination: ${destination}. Change where it merges`}>
          {look === 'chip' && <GitBranch size={12} className={chipStyles.icon} aria-hidden />}
          <span className={styles.name}>
            {/* Keyed by the name: a fitted label measures its width once, so a new name starts it afresh. */}
            <PathLabel key={changingTo ?? destination} path={changingTo ?? destination} fitContent tooltip={false} />
          </span>
          {changingTo !== undefined ? <Spinner size={12} /> : <ChevronDown size={12} className={styles.chevron} aria-hidden />}
        </button>
      }
    >
      <BranchChoiceList place={place} groupsOf={destinationChoices} current={destination} placeholder="Merge into…" onPick={(branch) => void pick(branch)} onLeave={() => setOpen(false)} />
    </Popover>
  );
}
