import { ChevronDown, FileCheck2, PencilLine, RotateCcw } from 'lucide-react';
import { Suspense, useRef, useState } from 'react';
import { PathLabel } from '../../../components/PathLabel';
import { SEPARATOR } from '../../../lib/actions';
import { lazyComponent } from '../../../lib/lazyComponent';
import { fileNameOf, pluralize } from '../../../lib/text';
import { Button } from '../../../ui/Button';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { STEP_FRAME, type StepView } from '../../diff/viewer/useStepNavigation';
import { ConflictStatusChip } from '../ConflictStatusChip';
import type { MergeLabels } from '../mergeDescription';
import { MergeToolButton, type ConflictToolActions } from '../mergeTools/MergeToolButton';
import { MergeToolOpenBanner } from '../mergeTools/MergeToolOpenBanner';
import { fileConflictStatus, fileConflictTool } from '../mergeStatus';
import { chosenConflictChoice, decisionFor, hasConflicts, type ConflictChoice } from './conflictChoices';
import { conflictsToStep, editInAppUnavailable, effectiveView, hasBase, justDecided, rendersVersions, type PanelView } from './conflictPanelView';
import { ConflictNavigator } from './ConflictNavigator';
import type { FileConflictDecision } from './fileConflictDecision';
import { KeepChoices } from './KeepChoices';
import type { FileConflictState } from './useFileConflicts';
import styles from './FileConflictPanel.module.css';

// The versions and the merged text (Pierre, the 3D model viewer) load on first use, under the panel's header and
// choices, which show at once.
const ConflictBody = lazyComponent(() => import('./ConflictBody').then((module) => module.ConflictBody));

/** A binary's choice is one conflict, the whole file, on screen as soon as the panel is. */
const WHOLE_FILE_CHOICE: StepView = { isShown: () => true, reveal: () => undefined, countAbove: () => 0, aboveAfterChange: () => 0 };

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
  const panelRef = useRef<HTMLDivElement>(null);
  const conflictView = useRef<StepView>(null);
  // Its last conflict resolved here, the file keeps the conflict arrows: they go straight on to the next file.
  const [sawConflicts, setSawConflicts] = useState(false);
  if (!sawConflicts && state.remainingConflicts > 0) setSawConflicts(true);
  const conflictCount = editing ? null : conflictsToStep(view, state, justDecided(sawConflicts, chosenView, state));
  const conflictsOnScreen: StepView = {
    isShown: () => conflictView.current?.isShown() ?? false,
    reveal: (index) => conflictView.current?.reveal(index),
    countAbove: () => conflictView.current?.countAbove() ?? 0,
    aboveAfterChange: () => conflictView.current?.aboveAfterChange() ?? 0,
  };
  const navigator = conflictCount !== null && (
    <ConflictNavigator count={conflictCount} view={view === 'choice' ? WHOLE_FILE_CHOICE : conflictsOnScreen} frame={panelRef} path={state.file.path} />
  );

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
      editInAppUnavailable={editInAppUnavailable(state)}
      // The primary action while the file waits for the user, unless the page offers resolving them all (or is at it);
      // once decided, completing the merge takes over.
      variant={state.resolution || toolActions.runOffered || toolActions.run ? 'secondary' : 'primary'}
    />
  );

  return (
    <div ref={panelRef} className={styles.panel} {...STEP_FRAME}>
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
            Editing <strong>{fileNameOf(state.file.path)}</strong>: remove every conflict marker.
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
        <MergeToolOpenBanner fileName={fileNameOf(state.file.path)} open={state.openTool} run={toolActions.run?.currentKey === state.file.key ? toolActions.run : null} />
      )}

      {(canMergeLines || rendersVersions(state) || navigator) && !editing && (
        <div className={styles.viewBar}>
          {(canMergeLines || rendersVersions(state)) && <SegmentedControl<PanelView> value={view} onChange={setChosenView} segments={viewSegments(state, labels)} />}
          {navigator}
        </div>
      )}

      <Suspense fallback={null}>
        <ConflictBody
          workspacePath={workspacePath}
          state={state}
          labels={labels}
          view={view}
          editing={editing}
          conflictViewRef={conflictView}
          changeArrows={conflictCount === null}
          onDecide={onDecide}
        />
      </Suspense>
    </div>
  );
}

function viewSegments(state: FileConflictState, labels: MergeLabels) {
  const { source, destination } = labels.roles;
  const sides = [
    { value: 'destination' as const, label: destination.name, title: `Base → ${labels.destination}` },
    { value: 'source' as const, label: source.name, title: `Base → ${labels.source}` },
    ...(hasBase(state) ? [{ value: 'base' as const, label: 'Base', title: 'Common ancestor' }] : []),
  ];
  // A binary's versions can't be merged: the first view is the one to keep, then what each side changed.
  if (state.isBinary) return [{ value: 'choice' as const, label: 'Choose', title: 'The version to keep' }, ...sides];
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
    ...sides,
  ];
}
