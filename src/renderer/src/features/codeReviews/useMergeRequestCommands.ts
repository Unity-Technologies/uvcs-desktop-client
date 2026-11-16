import { useMemo } from 'react';
import type { Place } from '@shared/domain/place';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { usePlace, useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { GitPullRequestPlus } from '../../components/GitPullRequestPlus';
import { branchWorkedOn } from '../../components/workingObject';
import { openCreateMergeRequestDialog } from './CreateMergeRequestDialog';
import { prefilledSourceOf } from './mergeRequestDraft';

/**
 * The palette's New merge request…, on the workspace's branch where it can merge somewhere (`prefilledSourceOf`).
 * `onCreated` gets the new request's id: the Merge requests view registers it again with its own, which selects the
 * new row, and a command registered later wins (`registeredCommands`) while the view shows.
 */
export function newMergeRequestCommand(place: Place, workspaceBranch: string | undefined, onCreated?: (reviewId: number) => void): Command {
  return {
    id: 'codeReviews.newMergeRequest',
    group: 'Merge requests',
    label: 'New merge request…',
    icon: GitPullRequestPlus,
    run: () => openCreateMergeRequestDialog(place, prefilledSourceOf(workspaceBranch), onCreated),
  };
}

/** New merge request… in the palette wherever a place shows, a workspace or a repository explored without one. */
export function useMergeRequestCommands(): void {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const workspaceBranch = branchWorkedOn(workspace?.selector);
  useCommands(useMemo(() => [newMergeRequestCommand(place, workspaceBranch)], [place, workspaceBranch]));
}
