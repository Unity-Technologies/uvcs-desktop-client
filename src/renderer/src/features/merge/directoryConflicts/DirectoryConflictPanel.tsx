import { FolderTree } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  RENAMEABLE_CONFLICTS,
  type ConflictSide,
  type DirectoryConflict,
  type DirectoryConflictResolution,
  type MergeContributors,
  type MergeRequest,
} from '@shared/domain/merge';
import { PathLabel } from '../../../components/PathLabel';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { TextField } from '../../../ui/TextField';
import { FileDiffViewer } from '../../diff/viewer/FileDiffViewer';
import type { MergeLabels } from '../mergeDescription';
import { comparedVersions, comparisonSegments, comparisonsOf, identicalNoteOf, type DirectoryConflictComparison } from './directoryConflictComparison';
import { renameNameProblem } from './renameNameProblem';
import { suggestRename } from './renameSuggestion';
import styles from './DirectoryConflictPanel.module.css';

interface DirectoryConflictPanelProps {
  workspacePath: string;
  request: MergeRequest;
  contributors: MergeContributors | undefined;
  conflict: DirectoryConflict;
  labels: MergeLabels;
  resolution: DirectoryConflictResolution | undefined;
  onResolve: (resolution: DirectoryConflictResolution) => void;
}

/** A structural conflict (moves, deletes, adds), the valid ways out, and the incoming item compared with yours or the base. */
export function DirectoryConflictPanel({ workspacePath, request, contributors, conflict, labels, resolution, onResolve }: DirectoryConflictPanelProps) {
  const canKeepBoth = RENAMEABLE_CONFLICTS.has(conflict.type);
  const renameTo = resolution?.choice === 'rename' ? resolution.newName : suggestRename(conflict.destination.path, labels.destination);
  const { source, destination } = labels.roles;

  return (
    <div className={styles.panel}>
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
                  error={renameNameProblem(resolution.newName)}
                />
              )}
            </Option>
          )}
        </div>
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
  const [comparison, setComparison] = useState<DirectoryConflictComparison>('destination');
  const comparisons = comparisonsOf(conflict, contributors);
  if (comparisons.length === 0) return null;
  const { original, modified } = comparedVersions(conflict, comparison, contributors, request);

  return (
    <section className={styles.comparison} aria-label="Compare">
      {comparisons.length > 1 && (
        <div className={styles.comparisonBar}>
          <SegmentedControl<DirectoryConflictComparison> value={comparison} onChange={setComparison} segments={comparisonSegments(comparisons, labels)} label="Compare" />
        </div>
      )}
      <FileDiffViewer
        workspacePath={workspacePath}
        original={original}
        modified={modified}
        fileName={conflict.source.path}
        title={<PathLabel path={conflict.source.path.replace(/^\//, '')} />}
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
