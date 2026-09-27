import { FolderTree } from 'lucide-react';
import type { ReactNode } from 'react';
import { RENAMEABLE_CONFLICTS, type ConflictSide, type DirectoryConflict, type DirectoryConflictResolution } from '@shared/domain/merge';
import { PathLabel } from '../../../components/PathLabel';
import { TextField } from '../../../ui/TextField';
import type { MergeLabels } from '../mergeDescription';
import { suggestRename } from './renameSuggestion';
import styles from './DirectoryConflictPanel.module.css';

interface DirectoryConflictPanelProps {
  conflict: DirectoryConflict;
  labels: MergeLabels;
  resolution: DirectoryConflictResolution | undefined;
  onResolve: (resolution: DirectoryConflictResolution) => void;
}

/** A structural conflict (moves, deletes, adds) and the valid ways out. */
export function DirectoryConflictPanel({ conflict, labels, resolution, onResolve }: DirectoryConflictPanelProps) {
  const canKeepBoth = RENAMEABLE_CONFLICTS.has(conflict.type);
  const renameTo = resolution?.choice === 'rename' ? resolution.newName : suggestRename(conflict.destination.path, labels.destination);
  const { source, destination } = labels.roles;

  return (
    <div className={styles.panel}>
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
          selected={resolution?.choice === 'destination'}
          title={`Keep ${destination.name.toLowerCase()}`}
          detail={<SideDetail side={conflict.destination} branch={labels.destination} />}
          onSelect={() => onResolve({ choice: 'destination' })}
        />
        <Option
          selected={resolution?.choice === 'source'}
          title={`Keep ${source.name.toLowerCase()}`}
          detail={<SideDetail side={conflict.source} branch={labels.source} />}
          onSelect={() => onResolve({ choice: 'source' })}
        />
        {canKeepBoth && (
          <Option
            selected={resolution?.choice === 'rename'}
            title="Keep both"
            detail={`${destination.name} gets a new name`}
            onSelect={() => onResolve({ choice: 'rename', newName: renameTo })}
          >
            {resolution?.choice === 'rename' && (
              <TextField
                label={`New name for ${destination.name.toLowerCase()}`}
                value={resolution.newName}
                onChange={(event) => onResolve({ choice: 'rename', newName: event.target.value })}
                error={/[\\/]/.test(resolution.newName) || !resolution.newName.trim() ? 'Enter a file name without folders.' : undefined}
              />
            )}
          </Option>
        )}
      </div>
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
  title: string;
  detail: ReactNode;
  onSelect: () => void;
  children?: ReactNode;
}

function Option({ selected, title, detail, onSelect, children }: OptionProps) {
  return (
    <div className={styles.option} data-selected={selected}>
      <button role="radio" aria-checked={selected} className={styles.optionButton} onClick={onSelect}>
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
