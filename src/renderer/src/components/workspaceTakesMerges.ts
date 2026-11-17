import { workspacePlace } from '@shared/domain/place';
import { queryClient } from '../app/queryClient';
import { workspaceInfoQuery } from '../app/workspace/useWorkspace';
import { offersMerges } from './mergesOffered';

/**
 * Whether the workspace at `workspacePath` takes a merge into it (`offersMerges`), by its kind as last read: a partial
 * one doesn't. For an operation that has just found it needs one, such as a shelve that conflicts, to say where it can
 * merge instead of opening a merge page `cm` would refuse.
 */
export function workspaceTakesMerges(workspacePath: string): boolean {
  const workspaceKind = queryClient.getQueryData(workspaceInfoQuery(workspacePath).queryKey)?.kind;
  return offersMerges({ place: workspacePlace(workspacePath), workspaceKind });
}
