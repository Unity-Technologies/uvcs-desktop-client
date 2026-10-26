import { FolderTree } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { RENAMEABLE_CONFLICTS, type ConflictSide, type DirectoryConflict, type DirectoryConflictResolution } from '@shared/domain/merge';
import { PathLabel } from '../../../components/PathLabel';
import { Button } from '../../../ui/Button';
import { Spinner } from '../../../ui/Spinner';
import { TextField } from '../../../ui/TextField';
import type { MergeLabels } from '../mergeDescription';
import { canKeepBothAs } from './directoryDecisions';
import { renameNameProblem } from './renameNameProblem';
import { suggestRename } from './renameSuggestion';
import styles from './DirectoryConflictPanel.module.css';

interface DirectoryConflictPanelProps {
  conflict: DirectoryConflict;
  labels: MergeLabels;
  /** The decision applied to the merge; none while the conflict waits. */
  resolution: DirectoryConflictResolution | undefined;
  /** This conflict's decision is being applied. */
  applying: boolean;
  /** A decision is being applied, this one's or another's: the choices wait for it. */
  locked: boolean;
  onResolve: (resolution: DirectoryConflictResolution) => void;
}

/**
 * A structural conflict (moves, deletes, adds) and the valid ways out. Keeping a side applies it at once; keeping both
 * applies once the name is confirmed, not on each key typed: each decision makes `cm` calculate the merge again.
 */
export function DirectoryConflictPanel({ conflict, labels, resolution, applying, locked, onResolve }: DirectoryConflictPanelProps) {
  const canKeepBoth = RENAMEABLE_CONFLICTS.has(conflict.type);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState(() => (resolution?.choice === 'rename' ? resolution.newName : suggestRename(conflict.destination.path, labels.destination)));
  const picked = naming ? 'rename' : resolution?.choice;
  const { source, destination } = labels.roles;

  const keepSide = (choice: 'source' | 'destination'): void => {
    setNaming(false);
    onResolve({ choice });
  };
  const keepBoth = (event: FormEvent): void => {
    event.preventDefault();
    if (canKeepBothAs(newName, resolution)) onResolve({ choice: 'rename', newName });
  };

  return (
    <div className={styles.panel} aria-busy={applying}>
      <header className={styles.header}>
        <span className={styles.icon}>
          <FolderTree size={18} />
        </span>
        <div>
          <h2 className={styles.title}>{conflict.title}</h2>
          <p className={styles.explanation}>{conflict.explanation}</p>
        </div>
      </header>

      {/* Yours first, as in the file conflicts' choices and blocks. */}
      <div className={styles.options} role="radiogroup" aria-label="How to resolve">
        <Option
          selected={picked === 'destination'}
          disabled={locked}
          title={`Keep ${destination.name.toLowerCase()}`}
          detail={<SideDetail side={conflict.destination} branch={labels.destination} />}
          onSelect={() => keepSide('destination')}
        />
        <Option
          selected={picked === 'source'}
          disabled={locked}
          title={`Keep ${source.name.toLowerCase()}`}
          detail={<SideDetail side={conflict.source} branch={labels.source} />}
          onSelect={() => keepSide('source')}
        />
        {canKeepBoth && (
          <Option selected={picked === 'rename'} disabled={locked} title="Keep both" detail={`${destination.name} gets a new name`} onSelect={() => setNaming(true)}>
            {picked === 'rename' && (
              <form className={styles.rename} onSubmit={keepBoth}>
                <TextField
                  label={`New name for ${destination.name.toLowerCase()}`}
                  value={newName}
                  disabled={locked}
                  onChange={(event) => setNewName(event.target.value)}
                  error={renameNameProblem(newName)}
                />
                <Button type="submit" variant="primary" size="small" disabled={locked || !canKeepBothAs(newName, resolution)}>
                  Apply
                </Button>
              </form>
            )}
          </Option>
        )}
      </div>

      {applying && (
        <p className={styles.applying}>
          <Spinner size={14} /> Updating the merge…
        </p>
      )}
    </div>
  );
}

/** "Added /shared.cfg   /main/…/task": what the side did, and where. */
function SideDetail({ side, branch }: { side: ConflictSide; branch: string }) {
  return (
    <>
      <span className={styles.sideDescription}>{side.description}</span>
      <PathLabel path={branch} />
    </>
  );
}

interface OptionProps {
  selected: boolean;
  disabled: boolean;
  title: string;
  detail: ReactNode;
  onSelect: () => void;
  children?: ReactNode;
}

function Option({ selected, disabled, title, detail, onSelect, children }: OptionProps) {
  return (
    <div className={styles.option} data-selected={selected}>
      <button role="radio" aria-checked={selected} className={styles.optionButton} disabled={disabled} onClick={onSelect}>
        <span className={styles.radio} />
        <span className={styles.optionText}>
          <span className={styles.optionTitle}>{title}</span>
          <span className={styles.optionDetail}>{detail}</span>
        </span>
      </button>
      {children && <div className={styles.optionExtra}>{children}</div>}
    </div>
  );
}
