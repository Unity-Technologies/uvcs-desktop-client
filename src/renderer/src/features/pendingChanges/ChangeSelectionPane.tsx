import { Files, Folder } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { rangeLength } from '../../lib/itemRange';
import { formatCount, pluralize } from '../../lib/text';
import { EmptyState } from '../../ui/EmptyState';
import { FileStepsContext, type FileSteps } from '../diff/viewer/fileSteps';
import { StepsAroundEmptyState } from '../diff/viewer/StepsAroundEmptyState';
import { ChangeDiffPanel } from './ChangeDiffPanel';
import type { ChangeRow } from './changeRows';
import type { ReviewMarks } from './review/pendingReviewStatus';

interface ChangeSelectionPaneProps {
  workspacePath: string;
  /** How many of the changes shown are selected. */
  selectedCount: number;
  /** The change the diff shows: it follows the selection once it settles. */
  diffChange: PendingChange | undefined;
  /** The Unity `.meta` listed with that change, whose diff it can show instead. */
  diffMeta: PendingChange | undefined;
  /** The folder or changelist the selection is on, when it is on no change. */
  focusedFolder: Exclude<ChangeRow, { type: 'file' }> | undefined;
  fileSteps: FileSteps;
  /** The row the selection is anchored on, as the list names it: with no diff shown, the arrows step on from it. */
  anchorKey: string | null;
  reviewMarks: ReviewMarks;
}

/** Beside the list of changes: the diff of the change selected, or what the selection holds instead. */
export function ChangeSelectionPane({ workspacePath, selectedCount, diffChange, diffMeta, focusedFolder, fileSteps, anchorKey, reviewMarks }: ChangeSelectionPaneProps) {
  // With no diff, what the selection holds shows under a diff's header, its arrows going on to the files around it.
  const besideSteps = (state: ReactNode) => (
    <StepsAroundEmptyState fileSteps={fileSteps} selectedKey={anchorKey ?? ''}>
      {state}
    </StepsAroundEmptyState>
  );
  if (selectedCount > 1) {
    return besideSteps(<EmptyState icon={<Files size={24} />} title={`${formatCount(selectedCount)} files selected`} description="Select a single file to see its diff." />);
  }
  if (diffChange) {
    return (
      <FileStepsContext.Provider value={fileSteps}>
        <ChangeDiffPanel workspacePath={workspacePath} change={diffChange} meta={diffMeta} reviewMark={reviewMarks.get(diffChange.path)} />
      </FileStepsContext.Provider>
    );
  }
  if (focusedFolder) {
    return besideSteps(
      <EmptyState
        icon={<Folder size={24} />}
        title={focusedFolder.type === 'group' ? focusedFolder.label : focusedFolder.path}
        description={`${pluralize(rangeLength(focusedFolder.held), 'change')}. Select a file to see its diff.`}
      />,
    );
  }
  return besideSteps(<EmptyState title="Select a change" description="Pick a file on the left to see what changed." />);
}
