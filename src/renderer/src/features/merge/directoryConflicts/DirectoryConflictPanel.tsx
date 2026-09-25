import { FolderTree } from 'lucide-react';
import { RENAMEABLE_CONFLICTS, type ConflictSide, type DirectoryConflict, type DirectoryConflictResolution } from '@shared/domain/merge';
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

/** Explains a structural conflict (moves, deletes, adds) in plain words and offers the valid ways out. */
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

      <div className={styles.sides}>
        <SideSummary label={`${source.name} · ${labels.source}`} side={conflict.source} />
        <SideSummary label={`${destination.name} · ${labels.destination}`} side={conflict.destination} />
      </div>

      <div className={styles.options} role="radiogroup" aria-label="How to resolve">
        <Option
          selected={resolution?.choice === 'source'}
          title={`Keep ${source.name.toLowerCase()}: the change from ${labels.source}`}
          detail={conflict.source.description}
          onSelect={() => onResolve({ choice: 'source' })}
        />
        <Option
          selected={resolution?.choice === 'destination'}
          title={`Keep ${destination.name.toLowerCase()}: the change from ${labels.destination}`}
          detail={conflict.destination.description}
          onSelect={() => onResolve({ choice: 'destination' })}
        />
        {canKeepBoth && (
          <Option
            selected={resolution?.choice === 'rename'}
            title="Keep both"
            detail={`The ${labels.destination} item gets a new name.`}
            onSelect={() => onResolve({ choice: 'rename', newName: renameTo })}
          >
            {resolution?.choice === 'rename' && (
              <TextField
                label="New name for the destination item"
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

function SideSummary({ label, side }: { label: string; side: ConflictSide }) {
  return (
    <div className={styles.side}>
      <span className={styles.sideLabel}>{label}</span>
      <span className={styles.sideDescription}>{side.description}</span>
    </div>
  );
}

interface OptionProps {
  selected: boolean;
  title: string;
  detail: string;
  onSelect: () => void;
  children?: React.ReactNode;
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
