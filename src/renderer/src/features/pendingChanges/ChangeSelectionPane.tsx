import { Files, Folder } from 'lucide-react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { formatCount, pluralize } from '../../lib/text';
import { EmptyState } from '../../ui/EmptyState';
import { FileStepsContext, type FileSteps } from '../diff/viewer/fileSteps';
import { ChangeDiffPanel } from './ChangeDiffPanel';
import type { ChangeRow } from './changeRows';
import type { ReviewMarks } from './review/pendingReviewStatus';

interface ChangeSelectionPaneProps {
  workspacePath: string;
  /** How many of the changes shown are selected. */
  selectedCount: number;
  /** The change the diff shows: it follows the selection once it settles. */
  diffChange: PendingChange | undefined;
  /** The folder or changelist the selection is on, when it is on no change. */
  focusedFolder: Exclude<ChangeRow, { type: 'change' }> | undefined;
  fileSteps: FileSteps;
  reviewMarks: ReviewMarks;
}

/** Beside the list of changes: the diff of the change selected, or what the selection holds instead. */
export function ChangeSelectionPane({ workspacePath, selectedCount, diffChange, focusedFolder, fileSteps, reviewMarks }: ChangeSelectionPaneProps) {
  if (selectedCount > 1) {
    return <EmptyState icon={<Files size={24} />} title={`${formatCount(selectedCount)} files selected`} description="Select a single file to see its diff." />;
  }
  if (diffChange) {
    return (
      <FileStepsContext.Provider value={fileSteps}>
        <ChangeDiffPanel workspacePath={workspacePath} change={diffChange} reviewMark={reviewMarks.get(diffChange.path)} />
      </FileStepsContext.Provider>
    );
  }
  if (focusedFolder) {
    return (
      <EmptyState
        icon={<Folder size={24} />}
        title={focusedFolder.type === 'group' ? focusedFolder.label : focusedFolder.path}
        description={`${pluralize(focusedFolder.changes.length, 'change')}. Select a file to see its diff.`}
      />
    );
  }
  return <EmptyState title="Select a change" description="Pick a file on the left to see what changed." />;
}
