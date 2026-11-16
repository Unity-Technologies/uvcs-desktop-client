import { ChevronDown, GitBranch } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import { PathLabel } from '../../components/PathLabel';
import { classNames } from '../../lib/classNames';
import fieldStyles from '../../ui/Field.module.css';
import { Popover } from '../../ui/Popover';
import { FieldFrame } from '../../ui/TextField';
import { BranchSearchList } from '../branches/BranchSearchList';
import { branchesRead, type BranchGroup } from '../branches/branchSearchRows';
import { useBranches } from '../branches/useBranches';
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
 * (`BranchSearchList`) to pick another. The branches are read only once it opens, the read the branch switcher shares:
 * a big repository holds thousands, and showing one needs none.
 */
export function BranchField({ label, value, placeholder, groupsOf, searchPlaceholder, onPick }: BranchFieldProps) {
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
        <BranchList
          value={value}
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

function BranchList({ value, groupsOf, placeholder, onPick }: { value: string | undefined; groupsOf: (branches: Branch[]) => BranchGroup[]; placeholder: string; onPick: (branch: Branch) => void }) {
  const branchesQuery = useBranches();
  const groups = useMemo(() => groupsOf(branchesQuery.data ?? []), [groupsOf, branchesQuery.data]);
  return <BranchSearchList groups={groups} currentBranch={value} read={branchesRead(branchesQuery)} placeholder={placeholder} onPick={onPick} />;
}
