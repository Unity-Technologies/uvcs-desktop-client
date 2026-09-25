import type { DirectoryConflictResolution, MergePlan, MergeRequest } from '@shared/domain/merge';
import { DirectoryConflictPanel } from './directoryConflicts/DirectoryConflictPanel';
import { MergeChangePreview } from './MergeChangePreview';
import type { MergeItem } from './mergeItems';
import type { ServerFilePolicy } from './mergeResolutions';
import { FileConflictPanel } from './resolve/FileConflictPanel';
import type { FileConflictDecision } from './resolve/fileConflictDecision';
import type { MergeLabels } from './mergeDescription';
import { ServerFilePolicyPanel } from './ServerFilePolicyPanel';

interface MergeDetailProps {
  workspacePath: string;
  item: MergeItem;
  plan: MergePlan;
  labels: MergeLabels;
  request: MergeRequest;
  serverPolicy: { needed: boolean; fileCount: number; policy: ServerFilePolicy | undefined; onChoose: (policy: ServerFilePolicy) => void };
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
  serverPolicy,
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
      if (request.destinationBranch && serverPolicy.needed) {
        return (
          <ServerFilePolicyPanel
            path={item.state.file.path}
            fileCount={serverPolicy.fileCount}
            labels={labels}
            policy={serverPolicy.policy}
            onChoose={serverPolicy.onChoose}
          />
        );
      }
      return (
        <FileConflictPanel
          key={item.key}
          workspacePath={workspacePath}
          state={item.state}
          labels={labels}
          onDecide={(decision) => onDecideFile(item.state.file.key, decision)}
          onStartOver={() => onStartOverFile(item.state.file.key)}
        />
      );
    case 'change':
      return <MergeChangePreview workspacePath={workspacePath} request={request} change={item.change} contributors={plan.contributors} labels={labels} />;
  }
}
