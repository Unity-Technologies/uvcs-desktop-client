import { ChevronDown, FileCheck2, PencilLine, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { PathLabel } from '../../../components/PathLabel';
import { SEPARATOR } from '../../../lib/actions';
import { pluralize } from '../../../lib/text';
import { Button } from '../../../ui/Button';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { ConflictStatusChip } from '../ConflictStatusChip';
import type { MergeLabels } from '../mergeDescription';
import { MergeToolButton, type ConflictToolActions } from '../mergeTools/MergeToolButton';
import { MergeToolOpenBanner } from '../mergeTools/MergeToolOpenBanner';
import { fileConflictStatus, fileConflictTool } from '../mergeStatus';
import { chosenConflictChoice, decisionFor, hasConflicts, type ConflictChoice } from './conflictChoices';
import { ConflictBody } from './ConflictBody';
import { effectiveView, fileNameOf, hasBase, type PanelView } from './conflictPanelView';
import type { FileConflictDecision } from './fileConflictDecision';
import { KeepChoices } from './KeepChoices';
import type { FileConflictState } from './useFileConflicts';
import styles from './FileConflictPanel.module.css';

interface FileConflictPanelProps {
  workspacePath: string;
  state: FileConflictState;
  labels: MergeLabels;
  toolActions: ConflictToolActions;
  onDecide: (decision: FileConflictDecision) => void;
  onStartOver: () => void;
}

/**
 * One file changed on both sides, read-only. Conflicts are resolved in a merge tool the user picks, decided one by one,
 * or for the whole file (keep a version or both; editing the text in the app stays in the tool menu); a file that
 * merges automatically can only be overridden by keeping one version.
 */
export function FileConflictPanel({ workspacePath, state, labels, toolActions, onDecide, onStartOver }: FileConflictPanelProps) {
  const [chosenView, setChosenView] = useState<PanelView>();
  /** While resolving by hand: the user's decision before, to put back if they discard their edits. */
  const [editingFrom, setEditingFrom] = useState<{ decision: FileConflictDecision | undefined }>();
  const editing = editingFrom !== undefined;
  const canMergeLines = state.status === 'ready' && !state.isBinary;
  const withConflicts = hasConflicts(state.document);
  const view = effectiveView(chosenView, state);
  const status = fileConflictStatus(state);
  const { source, destination } = labels.roles;

  const choose = (choice: ConflictChoice): void => {
    if (choice === 'byHand') setEditingFrom({ decision: state.decidedByUser ? state.decision : undefined });
    else if (state.document) onDecide(decisionFor(choice, state.document));
  };
  const discardEdits = (): void => {
    if (editingFrom?.decision) onDecide(editingFrom.decision);
    else onStartOver();
    setEditingFrom(undefined);
  };

  const toolButton = (
    <MergeToolButton
      state={state}
      actions={toolActions}
      onEditInApp={() => choose('byHand')}
      // The primary action while the file waits for the user, unless the page offers resolving them all (or is at it);
      // once decided, completing the merge takes over.
      variant={state.resolution || toolActions.runOffered || toolActions.run ? 'secondary' : 'primary'}
    />
  );

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.file}>
          <PathLabel path={state.file.path} fitContent />
          <ConflictStatusChip status={status} labels={labels} tool={fileConflictTool(state)} />
        </div>
        {/* A binary keeps one of its versions, picked on its cards: no merge tool merges it. */}
        {!editing && !state.openTool && canMergeLines && (
          <div className={styles.controls} role="group" aria-label="Resolve this conflict">
            {withConflicts && (
              <>
                {toolButton}
                <KeepChoices
                  labels={labels}
                  chosen={chosenConflictChoice(status, state.decision, state.document)}
                  onChoose={choose}
                  onStartOver={state.decidedByUser ? onStartOver : undefined}
                />
              </>
            )}
            {!withConflicts && (
              <ActionDropdownMenu
                entries={[
                  { id: 'destination', label: `Keep ${destination.version} (${labels.destination})`, icon: FileCheck2, run: () => onDecide({ kind: 'wholeFile', side: 'destination' }) },
                  { id: 'source', label: `Keep ${source.version} (${labels.source})`, icon: FileCheck2, run: () => onDecide({ kind: 'wholeFile', side: 'source' }) },
                  ...(state.decidedByUser ? [SEPARATOR, { id: 'startOver', label: 'Back to the automatic merge', icon: RotateCcw, run: onStartOver }] : []),
                ]}
              >
                <Button size="small" icon={<ChevronDown size={13} />} aria-label="Override the automatic merge" data-tip="Override the automatic merge" />
              </ActionDropdownMenu>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className={styles.editBanner} role="status">
          <PencilLine size={13} />
          <span className={styles.bannerText}>
            Editing <strong>{fileNameOf(state)}</strong>: remove every conflict marker.
          </span>
          <Button size="small" variant="ghost" onClick={discardEdits}>
            Discard edits
          </Button>
          <Button size="small" variant="primary" onClick={() => setEditingFrom(undefined)}>
            Done
          </Button>
        </div>
      )}
      {state.openTool && (
        <MergeToolOpenBanner fileName={fileNameOf(state)} open={state.openTool} run={toolActions.run?.currentKey === state.file.key ? toolActions.run : null} />
      )}

      {canMergeLines && !editing && (
        <div className={styles.viewBar}>
          <SegmentedControl<PanelView> value={view} onChange={setChosenView} segments={viewSegments(state, labels)} />
        </div>
      )}

      <ConflictBody
        workspacePath={workspacePath}
        state={state}
        labels={labels}
        view={view}
        editing={editing}
        onDecide={onDecide}
      />
    </div>
  );
}

function viewSegments(state: FileConflictState, labels: MergeLabels) {
  const { source, destination } = labels.roles;
  return [
    state.remainingConflicts > 0
      ? {
          value: 'conflicts' as const,
          label: (
            <>
              Conflicts<span className={styles.count}>{state.remainingConflicts}</span>
            </>
          ),
          title: `${pluralize(state.remainingConflicts, 'conflict')} left`,
        }
      : { value: 'changes' as const, label: 'Changes', title: `${destination.name} now → after the merge` },
    { value: 'destination' as const, label: destination.name, title: `Base → ${labels.destination}` },
    { value: 'source' as const, label: source.name, title: `Base → ${labels.source}` },
    ...(hasBase(state) ? [{ value: 'base' as const, label: 'Base', title: 'Common ancestor' }] : []),
  ];
}
