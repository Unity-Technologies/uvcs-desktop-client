import type { ReactNode } from 'react';
import { ExpandableDiffContext } from '../../../components/expandableDiffContext';
import { DiffViewerFrame } from './DiffViewerFrame';
import { FileOnlyNavigator } from './FileOnlyNavigator';
import { FileStepsContext, type FileSteps } from './fileSteps';

interface StepsAroundEmptyStateProps {
  /** The list's files, which the arrows go on to. */
  fileSteps: FileSteps;
  /** The row selected, as the list names it (a folder's, a group's): the arrows step on from it. */
  selectedKey: string;
  /** What the selection holds instead of a diff: a folder's, a group's, several files' `EmptyState`. */
  children: ReactNode;
}

/**
 * What a list's detail pane shows on a selection with no diff (a folder, a status group, several files), under the
 * header a diff has, with its arrows where a diff's are: they go on to the files from the row selected
 * (`FileSteps.neighbor`, `adjacentKey`'s `rowOrder`), so stepping through the list with ↓ never finds them gone.
 */
export function StepsAroundEmptyState({ fileSteps, selectedKey, children }: StepsAroundEmptyStateProps) {
  return (
    <FileStepsContext.Provider value={fileSteps}>
      {/* Nothing to expand: no Expand button beside the arrows. */}
      <ExpandableDiffContext.Provider value={false}>
        <DiffViewerFrame navigator={<FileOnlyNavigator path={selectedKey} />}>{children}</DiffViewerFrame>
      </ExpandableDiffContext.Provider>
    </FileStepsContext.Provider>
  );
}
