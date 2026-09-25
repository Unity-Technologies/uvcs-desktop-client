import { ChevronDown, FileCheck2, PencilLine, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { FileContent } from '@shared/domain/content';
import { PathLabel } from '../../../components/PathLabel';
import { pluralize } from '../../../lib/text';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { CenteredSpinner } from '../../../ui/Spinner';
import { FileDiffViewer } from '../../diff/viewer/FileDiffViewer';
import { LoadedFileDiff } from '../../diff/viewer/LoadedFileDiff';
import { ConflictStatusChip } from '../ConflictStatusChip';
import type { MergeLabels } from '../mergeDescription';
import { MergeToolButton, type ConflictToolActions } from '../mergeTools/MergeToolButton';
import { MergeToolOpenBanner } from '../mergeTools/MergeToolOpenBanner';
import { fileConflictStatus, fileConflictTool } from '../mergeStatus';
import { chosenConflictChoice, decisionFor, hasConflicts, type ConflictChoice } from './conflictChoices';
import { KeepChoices } from './KeepChoices';
import { ConflictHunks } from './ConflictHunks';
import type { FileConflictDecision } from './fileConflictDecision';
import { HandEditor } from './HandEditor';
import { ReadOnlyText } from './ReadOnlyText';
import type { FileConflictState } from './useFileConflicts';
import { WholeFileChoice } from './WholeFileChoice';
import styles from './FileConflictPanel.module.css';

/**
 * What to look at: the conflicts left to decide or, once none is left, what the merge changes in the destination; or
 * one contributor (each side against the base, or the base itself).
 */
type PanelView = 'conflicts' | 'changes' | 'destination' | 'source' | 'base';

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
      onEditInApp={canMergeLines ? () => choose('byHand') : undefined}
      // The primary action while the file waits for the user; once decided, completing the merge takes over.
      variant={state.resolution ? 'secondary' : 'primary'}
    />
  );

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.file}>
          <PathLabel path={state.file.path} fitContent />
          <ConflictStatusChip status={status} labels={labels} tool={fileConflictTool(state)} />
        </div>
        {!editing && !state.openTool && state.status === 'ready' && (
          <div className={styles.controls} role="group" aria-label="Resolve this conflict">
            {state.isBinary && toolButton}
            {canMergeLines && withConflicts && (
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
            {canMergeLines && !withConflicts && (
              <ActionDropdownMenu
                entries={[
                  { id: 'destination', label: `Keep ${destination.version} (${labels.destination})`, icon: FileCheck2, run: () => onDecide({ kind: 'wholeFile', side: 'destination' }) },
                  { id: 'source', label: `Keep ${source.version} (${labels.source})`, icon: FileCheck2, run: () => onDecide({ kind: 'wholeFile', side: 'source' }) },
                  ...(state.decidedByUser ? [{ id: 'startOver', label: 'Back to the automatic merge', icon: RotateCcw, run: onStartOver }] : []),
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
            Editing <strong>{fileName(state)}</strong>: remove every conflict marker.
          </span>
          <Button size="small" variant="ghost" onClick={discardEdits}>
            Discard edits
          </Button>
          <Button size="small" variant="primary" onClick={() => setEditingFrom(undefined)}>
            Done
          </Button>
        </div>
      )}
      {state.openTool && <MergeToolOpenBanner fileName={fileName(state)} open={state.openTool} />}

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
        onStartOver={onStartOver}
      />
    </div>
  );
}

/** The text the merge will write, once no conflict is left in it; null for binaries and while conflicts remain. */
function mergedText(state: FileConflictState): string | null {
  const { decision, contents } = state;
  if (state.status !== 'ready' || state.isBinary || !decision || !contents) return null;
  if (decision.kind === 'wholeFile') return contents[decision.side].text ?? '';
  return state.remainingConflicts > 0 ? null : decision.text;
}

/** Conflicts and changes share the first place: a file shows its conflicts while any is left, then what it changes. */
function effectiveView(chosen: PanelView | undefined, state: FileConflictState): PanelView {
  const first = state.remainingConflicts > 0 ? 'conflicts' : 'changes';
  if (chosen === undefined || chosen === 'conflicts' || chosen === 'changes') return first;
  if (chosen === 'base' && !hasBase(state)) return first;
  return chosen;
}

function hasBase(state: FileConflictState): boolean {
  return state.file.base.kind !== 'empty';
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

interface ConflictBodyProps extends Omit<FileConflictPanelProps, 'toolActions'> {
  view: PanelView;
  editing: boolean;
}

function ConflictBody({ workspacePath, state, labels, view, editing, onDecide }: ConflictBodyProps) {
  const { file, decision, contents } = state;

  if (state.status === 'loading') return <CenteredSpinner />;
  if (state.status === 'error' || !contents) return <EmptyState title="Couldn't read this file" description={state.error?.message} />;

  if (state.isBinary) {
    return (
      <WholeFileChoice
        contents={contents}
        labels={labels}
        chosen={decision?.kind === 'wholeFile' ? decision.side : undefined}
        onChoose={(side) => onDecide({ kind: 'wholeFile', side })}
      />
    );
  }

  if (editing) {
    return <HandEditor path={file.path} text={textToEdit(state)} onChange={(text) => onDecide({ kind: 'text', text, edited: true })} />;
  }

  switch (view) {
    case 'conflicts':
      // The merge tool has the file: picking sides here meanwhile would be overwritten by what it saves.
      if (state.openTool) return <ConflictHunks path={file.path} text={decision?.kind === 'text' ? decision.text : ''} labels={labels} />;
      return (
        <ConflictHunks
          path={file.path}
          text={decision?.kind === 'text' ? decision.text : ''}
          labels={labels}
          onChange={(text) => onDecide({ kind: 'text', text, edited: decision?.kind === 'text' && decision.edited })}
        />
      );
    case 'changes':
      return (
        <LoadedFileDiff
          workspacePath={workspacePath}
          // The merged result lives in memory: nothing to read it from, nor to edit in place.
          contents={{ original: file.destination, modified: { kind: 'empty' }, left: contents.destination, right: textContent(mergedText(state) ?? '') }}
          fileName={file.path}
          title={
            <span className={styles.diffTitle} data-tip={labels.destination}>
              {labels.roles.destination.name} now → after the merge
            </span>
          }
          identicalDescription={`The merge leaves ${labels.roles.destination.version} of this file as it is.`}
        />
      );
    case 'destination':
    case 'source':
      return (
        <FileDiffViewer
          workspacePath={workspacePath}
          original={file.base}
          modified={view === 'source' ? file.source : file.destination}
          fileName={file.path}
          title={
            <span className={styles.diffTitle} data-tip={view === 'source' ? labels.source : labels.destination}>
              Base → {view === 'source' ? labels.roles.source.name : labels.roles.destination.name}
            </span>
          }
        />
      );
    case 'base':
      return <ReadOnlyText path={file.path} text={contents.base.text ?? ''} />;
  }
}

function fileName(state: FileConflictState): string {
  return state.file.path.split('/').pop()!;
}

/** Resolving by hand starts from where the file stands: the merged text with its conflict markers, or the result chosen. */
function textToEdit(state: FileConflictState): string {
  const { decision, contents, document } = state;
  if (decision?.kind === 'wholeFile') return contents?.[decision.side].text ?? '';
  return decision?.text ?? document?.text ?? '';
}

function textContent(text: string): FileContent {
  return { text, isBinary: false, size: new TextEncoder().encode(text).length };
}
