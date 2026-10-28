import { FolderTree } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  RENAMEABLE_CONFLICTS,
  type ConflictSide,
  type DirectoryConflict,
  type DirectoryConflictResolution,
  type MergeContributors,
  type MergeRequest,
} from '@shared/domain/merge';
import { workspacePlace } from '@shared/domain/place';
import { PathLabel } from '../../../components/PathLabel';
import { Button } from '../../../ui/Button';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { Spinner } from '../../../ui/Spinner';
import { TextField } from '../../../ui/TextField';
import { FileDiffViewer } from '../../diff/viewer/FileDiffViewer';
import type { MergeLabels } from '../mergeDescription';
import { canKeepBothAs, pickedChoice } from './directoryDecisions';
import { comparedVersions, comparisonSegments, comparisonsOf, FIRST_COMPARISON, identicalNoteOf, type DirectoryConflictComparison } from './directoryConflictComparison';
import { renameNameProblem } from './renameNameProblem';
import { suggestRename } from './renameSuggestion';
import styles from './DirectoryConflictPanel.module.css';

interface DirectoryConflictPanelProps {
  workspacePath: string;
  request: MergeRequest;
  contributors: MergeContributors | undefined;
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
 * A structural conflict (moves, deletes, adds), the valid ways out, and the incoming item compared with yours or the
 * base. Keeping a side applies it at once; keeping both applies once the name is confirmed, not on each key typed: each
 * decision makes `cm` calculate the merge again.
 */
export function DirectoryConflictPanel({ workspacePath, request, contributors, conflict, labels, resolution, applying, locked, onResolve }: DirectoryConflictPanelProps) {
  const canKeepBoth = RENAMEABLE_CONFLICTS.has(conflict.type);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState(() => (resolution?.choice === 'rename' ? resolution.newName : suggestRename(conflict.destination.path, labels.destination)));
  const picked = pickedChoice(naming, resolution);
  const { source, destination } = labels.roles;

  // While a decision applies, the choices wait without being disabled: a disabled button would drop the keyboard's focus.
  const keepSide = (choice: 'source' | 'destination'): void => {
    if (locked) return;
    setNaming(false);
    onResolve({ choice });
  };
  const keepBoth = (event: FormEvent): void => {
    event.preventDefault();
    if (!locked && canKeepBothAs(newName, resolution)) onResolve({ choice: 'rename', newName });
  };

  return (
    <div className={styles.panel} aria-busy={applying}>
      <div className={styles.decision}>
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
            <Option selected={picked === 'rename'} disabled={locked} title="Keep both" detail={`${destination.name} gets a new name`} onSelect={() => !locked && setNaming(true)}>
              {picked === 'rename' && (
                <form className={styles.rename} onSubmit={keepBoth}>
                  <TextField
                    label={`New name for ${destination.name.toLowerCase()}`}
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    error={renameNameProblem(newName)}
                  />
                  <Button type="submit" variant="primary" size="small" disabled={!canKeepBothAs(newName, resolution)} aria-disabled={locked}>
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
      {contributors && <Comparison workspacePath={workspacePath} request={request} contributors={contributors} conflict={conflict} labels={labels} />}
    </div>
  );
}

interface ComparisonProps {
  workspacePath: string;
  request: MergeRequest;
  contributors: MergeContributors;
  conflict: DirectoryConflict;
  labels: MergeLabels;
}

/** The incoming item diffed with yours or with the base, where the conflict has a file to compare (`comparisonsOf`). */
function Comparison({ workspacePath, request, contributors, conflict, labels }: ComparisonProps) {
  const [comparison, setComparison] = useState(FIRST_COMPARISON);
  const comparisons = comparisonsOf(conflict, contributors, request);
  if (comparisons.length === 0) return null;
  const segments = comparisonSegments(comparisons, labels);
  const { original, modified, path, oldPath } = comparedVersions(conflict, comparison, contributors, request);

  return (
    <section className={styles.comparison} aria-label="Compare">
      {segments.length > 0 && (
        <div className={styles.comparisonBar}>
          <SegmentedControl<DirectoryConflictComparison> value={comparison} onChange={setComparison} segments={segments} label="Compare" />
        </div>
      )}
      <FileDiffViewer
        place={workspacePlace(workspacePath)}
        original={original}
        modified={modified}
        fileName={path}
        title={<PathLabel path={path.replace(/^\//, '')} oldPath={oldPath?.replace(/^\//, '')} />}
        identicalDescription={identicalNoteOf(conflict, comparison)}
      />
    </section>
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
      <button role="radio" aria-checked={selected} className={styles.optionButton} aria-disabled={disabled} onClick={onSelect}>
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
