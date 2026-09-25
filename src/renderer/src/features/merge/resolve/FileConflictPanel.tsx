import { ChevronDown, FileCheck2, PencilLine, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { FileContent } from '@shared/domain/content';
import { PathLabel } from '../../../components/PathLabel';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { CenteredSpinner } from '../../../ui/Spinner';
import { FileDiffViewer } from '../../diff/viewer/FileDiffViewer';
import { LoadedFileDiff } from '../../diff/viewer/LoadedFileDiff';
import { ConflictStatusChip } from '../ConflictStatusChip';
import type { MergeLabels } from '../mergeDescription';
import { fileConflictStatus } from '../mergeStatus';
import type { FileConflictDecision } from './fileConflictDecision';
import { MergedTextEditor } from './MergedTextEditor';
import { ReadOnlyText } from './ReadOnlyText';
import type { FileConflictState } from './useFileConflicts';
import { WholeFileChoice } from './WholeFileChoice';
import styles from './FileConflictPanel.module.css';

/**
 * What to look at: what the merge changes in the destination, the merged result, or one contributor (each side
 * against the base, or the base itself).
 */
type PanelView = 'changes' | 'result' | 'destination' | 'source' | 'base';

interface FileConflictPanelProps {
  workspacePath: string;
  state: FileConflictState;
  labels: MergeLabels;
  onDecide: (decision: FileConflictDecision) => void;
  onStartOver: () => void;
}

/**
 * One file changed on both sides. Read-only until the user asks to edit the merged result; conflicts are decided one by
 * one in the result, or by keeping a whole version.
 */
export function FileConflictPanel({ workspacePath, state, labels, onDecide, onStartOver }: FileConflictPanelProps) {
  const [chosenView, setChosenView] = useState<PanelView>();
  /** While editing: the user's decision before, to put back if they discard their edits. */
  const [editingFrom, setEditingFrom] = useState<{ decision: FileConflictDecision | undefined }>();
  const editing = editingFrom !== undefined;
  const canMergeLines = state.status === 'ready' && !state.isBinary;
  const result = mergedText(state);
  const view = effectiveView(chosenView, state, result);
  const { source, destination } = labels.roles;

  const keepWholeFile = (side: 'source' | 'destination'): void => onDecide({ kind: 'wholeFile', side });
  const startEditing = (): void => {
    setEditingFrom({ decision: state.decidedByUser ? state.decision : undefined });
    setChosenView('result');
  };
  const discardEdits = (): void => {
    if (editingFrom?.decision) onDecide(editingFrom.decision);
    else onStartOver();
    setEditingFrom(undefined);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <PathLabel path={state.file.path} fitContent />
        <ConflictStatusChip status={fileConflictStatus(state)} labels={labels} />
        <div className={styles.spacer} />
        {canMergeLines && !editing && (
          <>
            <Button size="small" icon={<PencilLine size={13} />} onClick={startEditing}>
              Edit merged result…
            </Button>
            <ActionDropdownMenu
              entries={[
                { id: 'destination', label: `Keep ${destination.version} (${labels.destination})`, icon: FileCheck2, run: () => keepWholeFile('destination') },
                { id: 'source', label: `Keep ${source.version} (${labels.source})`, icon: FileCheck2, run: () => keepWholeFile('source') },
                { id: 'startOver', label: 'Start over from the automatic merge', icon: RotateCcw, run: onStartOver },
              ]}
            >
              <Button size="small" icon={<ChevronDown size={13} />} aria-label="More ways to resolve" />
            </ActionDropdownMenu>
          </>
        )}
      </div>

      {editing ? (
        <div className={styles.editBanner} role="status">
          <PencilLine size={13} />
          <span className={styles.bannerText}>
            You're editing the merged result of <strong>{state.file.path.split('/').pop()}</strong>. It's written to your workspace when you complete the merge.
          </span>
          <Button size="small" variant="ghost" onClick={discardEdits}>
            Discard edits
          </Button>
          <Button size="small" variant="primary" onClick={() => setEditingFrom(undefined)}>
            Done
          </Button>
        </div>
      ) : (
        canMergeLines && (
          <div className={styles.viewBar}>
            <SegmentedControl<PanelView> value={view} onChange={setChosenView} segments={viewSegments(state, labels, result)} />
            <span className={styles.helper}>{viewHelper(view, state, labels)}</span>
          </div>
        )
      )}

      <ConflictBody
        workspacePath={workspacePath}
        state={state}
        labels={labels}
        view={editing ? 'result' : view}
        result={result}
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

/** Files waiting for a decision open on the result, where the conflicts are decided; the rest on what changes. */
function effectiveView(chosen: PanelView | undefined, state: FileConflictState, result: string | null): PanelView {
  if (chosen === 'changes' && result === null) return 'result';
  if (chosen === 'base' && !hasBase(state)) return 'result';
  return chosen ?? (result === null ? 'result' : 'changes');
}

function hasBase(state: FileConflictState): boolean {
  return state.file.base.kind !== 'empty';
}

function viewSegments(state: FileConflictState, labels: MergeLabels, result: string | null) {
  const { source, destination } = labels.roles;
  return [
    ...(result === null
      ? []
      : [{ value: 'changes' as const, label: 'What changes', title: `What the merge will change in ${destination.version} (${labels.destination})` }]),
    { value: 'result' as const, label: 'Merged result', title: 'The file as the merge will write it' },
    { value: 'destination' as const, label: destination.name, title: `${capitalize(destination.version)}: ${labels.destination}` },
    { value: 'source' as const, label: source.name, title: `${capitalize(source.version)}: ${labels.source}` },
    ...(hasBase(state) ? [{ value: 'base' as const, label: 'Base', title: 'The common ancestor both sides started from' }] : []),
  ];
}

function viewHelper(view: PanelView, state: FileConflictState, labels: MergeLabels): string {
  const { source, destination } = labels.roles;
  switch (view) {
    case 'changes':
      return `${capitalize(destination.version)} now, and after the merge.`;
    case 'result':
      if (state.remainingConflicts > 0) {
        return `${state.remainingConflicts} ${state.remainingConflicts === 1 ? 'conflict' : 'conflicts'} left: pick a side for each, below.`;
      }
      return 'The file after the merge. Read-only: use Edit merged result to adjust it.';
    case 'destination':
      return `What changed in ${destination.version} since the base.`;
    case 'source':
      return `What changed in ${source.version} since the base.`;
    case 'base':
      return 'The version both sides started from.';
  }
}

interface ConflictBodyProps extends FileConflictPanelProps {
  view: PanelView;
  result: string | null;
  editing: boolean;
}

function ConflictBody({ workspacePath, state, labels, view, result, editing, onDecide, onStartOver }: ConflictBodyProps) {
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

  switch (view) {
    case 'changes':
      return (
        <LoadedFileDiff
          workspacePath={workspacePath}
          // The merged result lives in memory: nothing to read it from, nor to edit in place.
          contents={{ original: file.destination, modified: { kind: 'empty' }, left: contents.destination, right: textContent(result ?? '') }}
          fileName={file.path}
          title={<span className={styles.diffTitle}>{labels.destination} now → after the merge</span>}
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
          title={<span className={styles.diffTitle}>Base → {view === 'source' ? labels.source : labels.destination}</span>}
        />
      );
    case 'base':
      return <ReadOnlyText path={file.path} text={contents.base.text ?? ''} />;
    case 'result':
      break;
  }

  if (decision?.kind === 'wholeFile' && !editing) {
    const side = decision.side === 'source' ? labels.roles.source : labels.roles.destination;
    return (
      <EmptyState
        icon={<FileCheck2 size={22} />}
        title={`Keeping ${side.version} (${decision.side === 'source' ? labels.source : labels.destination})`}
        description="The whole file will be taken from that side."
        action={<Button onClick={onStartOver}>Merge line by line instead</Button>}
      />
    );
  }

  return (
    <MergedTextEditor
      key={editing ? 'editing' : 'resolving'}
      path={file.path}
      text={editing ? (result ?? (decision?.kind === 'text' ? decision.text : '')) : decision?.kind === 'text' ? decision.text : ''}
      labels={labels}
      hasConflicts={state.remainingConflicts > 0}
      editing={editing}
      onChange={(text) => onDecide({ kind: 'text', text, edited: editing || (decision?.kind === 'text' && decision.edited) })}
    />
  );
}

function textContent(text: string): FileContent {
  return { text, isBinary: false, size: new TextEncoder().encode(text).length };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
