import { ChevronDown, GitBranch } from 'lucide-react';
import { useId, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import { PathLabel } from '../../components/PathLabel';
import { classNames } from '../../lib/classNames';
import fieldStyles from '../../ui/Field.module.css';
import { Popover } from '../../ui/Popover';
import { FieldFrame } from '../../ui/TextField';
import { usePlace } from '../../app/workspace/useWorkspace';
import { BranchChoiceList } from '../branches/BranchChoiceList';
import type { BranchGroup } from '../branches/branchSearchRows';
import styles from './BranchField.module.css';

interface BranchFieldProps {
  label: string;
  /** The branch picked; none shows `placeholder`. */
  value: string | undefined;
  placeholder: string;
  /** The branch list's groups, from every branch read; memoized by the caller. */
  groupsOf: (branches: Branch[]) => BranchGroup[];
  /** The list's filter field's placeholder. */
  searchPlaceholder: string;
  onPick: (branch: Branch) => void;
}

/**
 * A dialog's branch, boxed as its other fields: it shows the branch picked and opens the branch list
 * (`BranchChoiceList`) to pick another, the branches read only once it opens.
 */
export function BranchField({ label, value, placeholder, groupsOf, searchPlaceholder, onPick }: BranchFieldProps) {
  const place = usePlace();
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <FieldFrame id={id} label={label}>
      <Popover
        width={420}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button id={id} type="button" className={classNames(fieldStyles.input, styles.trigger)}>
            <GitBranch size={13} className={styles.icon} aria-hidden />
            <span className={styles.name}>{value ? <PathLabel key={value} path={value} tooltip={false} /> : <span className={styles.placeholder}>{placeholder}</span>}</span>
            <ChevronDown size={12} className={styles.icon} aria-hidden />
          </button>
        }
      >
        <BranchChoiceList
          place={place}
          current={value}
          groupsOf={groupsOf}
          placeholder={searchPlaceholder}
          onPick={(branch) => {
            setOpen(false);
            onPick(branch);
          }}
        />
      </Popover>
    </FieldFrame>
  );
}
