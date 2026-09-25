import { ChevronDown, FileCheck2, PencilLine, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { PathLabel } from '../../../components/PathLabel';
import { StatusBadge } from '../../../components/StatusBadge';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { CenteredSpinner } from '../../../ui/Spinner';
import { FileDiffViewer } from '../../diff/viewer/FileDiffViewer';
import type { FileConflictDecision } from './fileConflictDecision';
import { MergedTextEditor } from './MergedTextEditor';
import type { ConflictLabels } from './threeWayMerge';
import type { FileConflictState } from './useFileConflicts';
import { WholeFileChoice } from './WholeFileChoice';
import styles from './FileConflictPanel.module.css';

/** The merged result, or what one side changed since the common ancestor. */
type PanelView = 'result' | 'source' | 'destination';

interface FileConflictPanelProps {
  workspacePath: string;
  state: FileConflictState;
  labels: ConflictLabels;
  onDecide: (decision: FileConflictDecision) => void;
  onStartOver: () => void;
}

/** Resolves one file changed on both sides: conflict by conflict, by hand, or keeping a whole version. */
export function FileConflictPanel({ workspacePath, state, labels, onDecide, onStartOver }: FileConflictPanelProps) {
  const [view, setView] = useState<PanelView>('result');
  const [editing, setEditing] = useState(false);
  const canMergeLines = state.status === 'ready' && !state.isBinary;

  const keepWholeFile = (side: 'source' | 'destination'): void => {
    setEditing(false);
    onDecide({ kind: 'wholeFile', side });
  };
  const startOver = (): void => {
    setEditing(false);
    onStartOver();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <StatusBadge
          tone={state.resolution ? 'added' : 'conflict'}
          title={state.resolution ? 'Resolved' : 'Needs a decision'}
          letter={state.resolution ? '✓' : '!'}
        />
        <PathLabel path={state.file.path} />
        <ResolutionChip state={state} />
        <div className={styles.spacer} />
        {canMergeLines && (
          <>
            <SegmentedControl<PanelView>
              value={view}
              onChange={setView}
              segments={[
                { value: 'result', label: 'Result' },
                { value: 'destination', label: labels.destination, title: `What ${labels.destination} changed since the common ancestor` },
                { value: 'source', label: labels.source, title: `What ${labels.source} changed since the common ancestor` },
              ]}
            />
            {state.decision?.kind === 'text' && view === 'result' && (
              <Button size="small" variant={editing ? 'primary' : 'secondary'} icon={<PencilLine size={13} />} onClick={() => setEditing(!editing)}>
                {editing ? 'Done editing' : 'Edit'}
              </Button>
            )}
            <ActionDropdownMenu
              entries={[
                { id: 'destination', label: `Keep the whole ${labels.destination} version`, icon: FileCheck2, run: () => keepWholeFile('destination') },
                { id: 'source', label: `Keep the whole ${labels.source} version`, icon: FileCheck2, run: () => keepWholeFile('source') },
                { id: 'startOver', label: 'Start over', icon: RotateCcw, run: startOver },
              ]}
            >
              <Button size="small" icon={<ChevronDown size={13} />} aria-label="More ways to resolve" />
            </ActionDropdownMenu>
          </>
        )}
      </div>
      <ConflictBody
        workspacePath={workspacePath}
        state={state}
        labels={labels}
        view={view}
        editing={editing}
        onDecide={onDecide}
        onStartOver={startOver}
      />
    </div>
  );
}

interface ConflictBodyProps extends FileConflictPanelProps {
  view: PanelView;
  editing: boolean;
}

function ConflictBody({ workspacePath, state, labels, view, editing, onDecide, onStartOver }: ConflictBodyProps) {
  const { file, decision } = state;

  if (state.status === 'loading') return <CenteredSpinner />;
  if (state.status === 'error') return <EmptyState title="Couldn't read this file" description={state.error?.message} />;

  if (state.isBinary) {
    return (
      <WholeFileChoice
        contents={state.contents!}
        labels={labels}
        chosen={decision?.kind === 'wholeFile' ? decision.side : undefined}
        onChoose={(side) => onDecide({ kind: 'wholeFile', side })}
      />
    );
  }

  if (view !== 'result') {
    return (
      <FileDiffViewer
        workspacePath={workspacePath}
        original={file.base}
        modified={view === 'source' ? file.source : file.destination}
        fileName={file.path}
        title={<span className={styles.diffTitle}>Common ancestor → {view === 'source' ? labels.source : labels.destination}</span>}
      />
    );
  }

  if (decision?.kind === 'wholeFile') {
    return (
      <EmptyState
        icon={<FileCheck2 size={22} />}
        title={`Keeping the ${decision.side === 'source' ? labels.source : labels.destination} version`}
        description="The whole file will be taken from that side."
        action={<Button onClick={onStartOver}>Merge line by line instead</Button>}
      />
    );
  }

  return (
    <MergedTextEditor
      key={editing ? 'editing' : 'resolving'}
      path={file.path}
      text={decision?.kind === 'text' ? decision.text : ''}
      labels={labels}
      hasConflicts={state.remainingConflicts > 0}
      editing={editing}
      onChange={(text) => onDecide({ kind: 'text', text })}
    />
  );
}

function ResolutionChip({ state }: { state: FileConflictState }) {
  if (state.status !== 'ready') return null;
  if (state.mergedAutomatically) return <span className={styles.chip} data-tone="resolved">Merged automatically</span>;
  if (state.resolution) return <span className={styles.chip} data-tone="resolved">Resolved</span>;
  if (state.isBinary) return <span className={styles.chip}>Choose a version</span>;
  return (
    <span className={styles.chip}>
      {state.remainingConflicts} {state.remainingConflicts === 1 ? 'conflict' : 'conflicts'} left
    </span>
  );
}
