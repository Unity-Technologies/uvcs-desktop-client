import type { DirectoryConflictResolution, MergePlan, MergeRequest } from '@shared/domain/merge';
import { DirectoryConflictPanel } from './directoryConflicts/DirectoryConflictPanel';
import { MergeChangePreview } from './MergeChangePreview';
import type { MergeItem } from './mergeItems';
import type { ConflictToolActions } from './mergeTools/MergeToolButton';
import { FileConflictPanel } from './resolve/FileConflictPanel';
import type { FileConflictDecision } from './resolve/fileConflictDecision';
import type { MergeLabels } from './mergeDescription';

interface MergeDetailProps {
  workspacePath: string;
  item: MergeItem;
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
          conflict={item.conflict}
          labels={labels}
          resolution={item.resolution}
          onResolve={(resolution) => onResolveDirectory(item.index, resolution)}
        />
      );
    case 'fileConflict':
      return (
        <FileConflictPanel
          key={item.key}
          workspacePath={workspacePath}
          state={item.state}
          labels={labels}
          toolActions={toolActions}
          onDecide={(decision) => onDecideFile(item.state.file.key, decision)}
          onStartOver={() => onStartOverFile(item.state.file.key)}
        />
      );
    case 'change':
      return <MergeChangePreview workspacePath={workspacePath} request={request} change={item.change} contributors={plan.contributors} labels={labels} />;
  }
}
