import { GitBranch } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { useBranches } from '../branches/useBranches';
import styles from './pickBranch.module.css';

interface PickBranchOptions {
  title: string;
  confirmLabel: string;
  /** A branch that can't be picked, e.g. the one the workspace is on. */
  exclude?: string;
}

/** Asks for a branch by name, with type-to-filter. Resolves to the full branch name, or undefined. */
export function pickBranch(options: PickBranchOptions): Promise<string | undefined> {
  return askDialog<string>((finish) => <BranchPickerDialog {...options} finish={finish} />);
}

function BranchPickerDialog({ title, confirmLabel, exclude, finish }: PickBranchOptions & { finish: (branch: string | undefined) => void }) {
  const { data: branches, isLoading } = useBranches();
  const [filter, setFilter] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const matches = (branches ?? []).filter((branch) => branch.name !== exclude && branch.name.toLowerCase().includes(filter.toLowerCase()));
  const chosen = matches[Math.min(highlighted, matches.length - 1)];

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setHighlighted((current) => Math.min(matches.length - 1, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1))));
  };

  return (
    <Dialog
      title={title}
      width={520}
      onClose={() => finish(undefined)}
      onSubmit={() => chosen && finish(chosen.name)}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!chosen}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div onKeyDown={onKeyDown}>
        <SearchField
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setHighlighted(0);
          }}
          placeholder="Find a branch"
          autoFocus
          width={472}
        />
      </div>
      <div className={styles.list}>
        {isLoading && <CenteredSpinner />}
        {matches.map((branch, index) => (
          <button
            key={branch.id}
            type="button"
            className={styles.branch}
            data-highlighted={branch === chosen}
            onMouseEnter={() => setHighlighted(index)}
            onClick={() => finish(branch.name)}
          >
            <GitBranch size={13} className={styles.icon} />
            <span className={styles.name}>{branch.name}</span>
            <span className={styles.comment}>{branch.comment}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
