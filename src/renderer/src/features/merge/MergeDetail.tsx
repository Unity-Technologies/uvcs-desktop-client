import type { DirectoryConflictResolution, MergePlan, MergeRequest } from '@shared/domain/merge';
import { DirectoryConflictPanel } from './directoryConflicts/DirectoryConflictPanel';
import { MergeChangePreview } from './MergeChangePreview';
import { fileStateOf, type MergeItem, type MergeProgress } from './mergeItems';
import type { ConflictToolActions } from './mergeTools/MergeToolButton';
import { FileConflictPanel } from './resolve/FileConflictPanel';
import type { FileConflictDecision } from './resolve/fileConflictDecision';
import type { MergeLabels } from './mergeDescription';

interface MergeDetailProps {
  workspacePath: string;
  item: MergeItem;
  progress: MergeProgress;
  plan: MergePlan;
  labels: MergeLabels;
  request: MergeRequest;
  toolActions: ConflictToolActions;
  onDecideFile: (key: string, decision: FileConflictDecision) => void;
  onStartOverFile: (key: string) => void;
  onResolveDirectory: (index: number, resolution: DirectoryConflictResolution) => void;
}

/** The right-hand side of the merge: whatever the selected item needs. */
export function MergeDetail({
  workspacePath,
  item,
  progress,
  plan,
  labels,
  request,
  toolActions,
  onDecideFile,
  onStartOverFile,
  onResolveDirectory,
}: MergeDetailProps) {
  switch (item.kind) {
    case 'directoryConflict':
      return (
        <DirectoryConflictPanel
          key={item.key}
          workspacePath={workspacePath}
          request={request}
          contributors={plan.contributors}
          conflict={item.conflict}
          labels={labels}
          resolution={progress.directoryResolutions[item.index]}
          onResolve={(resolution) => onResolveDirectory(item.index, resolution)}
        />
      );
    case 'fileConflict':
      return (
        <FileConflictPanel
          key={item.key}
          workspacePath={workspacePath}
          state={fileStateOf(item, progress)}
          labels={labels}
          yoursInWorkspace={!request.destinationBranch}
          toolActions={toolActions}
          onDecide={(decision) => onDecideFile(item.file.key, decision)}
          onStartOver={() => onStartOverFile(item.file.key)}
        />
      );
    case 'change':
      return <MergeChangePreview workspacePath={workspacePath} request={request} change={item.change} contributors={plan.contributors} labels={labels} />;
  }
}
