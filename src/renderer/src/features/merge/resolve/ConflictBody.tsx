import type { FileContent } from '@shared/domain/content';
import { EmptyState } from '../../../ui/EmptyState';
import { CenteredSpinner } from '../../../ui/Spinner';
import { FileDiffViewer } from '../../diff/viewer/FileDiffViewer';
import { LoadedFileDiff } from '../../diff/viewer/LoadedFileDiff';
import type { MergeLabels } from '../mergeDescription';
import { ConflictHunks } from './ConflictHunks';
import { mergedText, textToEdit, type PanelView } from './conflictPanelView';
import type { FileConflictDecision } from './fileConflictDecision';
import { HandEditor } from './HandEditor';
import { ReadOnlyText } from './ReadOnlyText';
import type { FileConflictState } from './useFileConflicts';
import { WholeFileChoice } from './WholeFileChoice';
import styles from './FileConflictPanel.module.css';

interface ConflictBodyProps {
  workspacePath: string;
  state: FileConflictState;
  labels: MergeLabels;
  view: PanelView;
  /** The user is editing the text in the app. */
  editing: boolean;
  onDecide: (decision: FileConflictDecision) => void;
}

/** Under a conflicting file's toolbar: its view, the hand editor, or a binary's versions to keep. */
export function ConflictBody({ workspacePath, state, labels, view, editing, onDecide }: ConflictBodyProps) {
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

function textContent(text: string): FileContent {
  return { text, isBinary: false, size: new TextEncoder().encode(text).length };
}
