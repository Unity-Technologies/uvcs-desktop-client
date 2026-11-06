import { SlidersHorizontal } from 'lucide-react';
import type { MergeRequest } from '@shared/domain/merge';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Popover } from '../../ui/Popover';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { pickChangeset } from '../changesets/ChangesetPickerDialog';
import type { MergeLabels } from './mergeDescription';
import {
  ancestorLabel,
  contributorSegments,
  hasMergeOptions,
  withAncestor,
  withIgnoreMergeTracking,
  type Contributor,
  type MergeOptionsOffered,
} from './mergeOptions';
import styles from './MergeOptionsMenu.module.css';

interface MergeOptionsMenuProps {
  request: MergeRequest;
  labels: MergeLabels;
  /** Which options this merge offers (`mergeOptionsOffered`). */
  offered: MergeOptionsOffered;
  /** Who contributes to every conflicting file; null while the files were decided differently (`contributorOf`). */
  contributor: Contributor | null;
  onContributorChange: (contributor: Contributor) => void;
  /** A request that calculates the merge differently: the page previews it again. */
  onRequestChange: (request: MergeRequest) => void;
}

/** How the merge is calculated, and who contributes to its conflicting files, behind one header button. */
export function MergeOptionsMenu({ request, labels, offered, contributor, onContributorChange, onRequestChange }: MergeOptionsMenuProps) {
  const changed = hasMergeOptions(request) || contributor !== 'both';

  const chooseAncestor = async (): Promise<void> => {
    const id = await pickChangeset({ title: 'Common ancestor' });
    if (id !== undefined) onRequestChange(withAncestor(request, id));
  };

  return (
    <Popover
      width={340}
      align="end"
      trigger={
        <Button variant="ghost" size="small" icon={<SlidersHorizontal size={13} />} className={styles.trigger} data-changed={changed || undefined}>
          Merge options
        </Button>
      }
    >
      <div className={styles.options}>
        {offered.contributor && (
          <section className={styles.section}>
            <h3 className={styles.title}>Conflicting files</h3>
            <SegmentedControl label="Conflicting files" value={contributor} segments={contributorSegments(labels)} onChange={onContributorChange} stretch />
          </section>
        )}
        {offered.ignoreMergeTracking && (
          <section className={styles.section}>
            <Checkbox
              label="Ignore merge tracking"
              checked={Boolean(request.ignoreMergeTracking)}
              onChange={(checked) => onRequestChange(withIgnoreMergeTracking(request, checked))}
            />
            <p className={styles.hint}>Apply the changes again, even those already merged.</p>
          </section>
        )}
        {offered.commonAncestor && (
          <section className={styles.section}>
            <h3 className={styles.title}>Common ancestor</h3>
            <div className={styles.ancestor}>
              <span className={styles.value}>{ancestorLabel(request)}</span>
              {request.ancestorSpec && (
                <Button variant="ghost" size="small" onClick={() => onRequestChange(withAncestor(request, null))}>
                  Calculate automatically
                </Button>
              )}
              <Button size="small" onClick={() => void chooseAncestor()}>
                Choose…
              </Button>
            </div>
          </section>
        )}
      </div>
    </Popover>
  );
}
