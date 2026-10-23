import { queryOptions, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { workspacePathOf, workspacePlace, type Place } from '@shared/domain/place';
import { otherRepository } from '@shared/domain/repository';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { repositoryOfPlace, serverOfPlace } from './placeOrigin';
import { useSession } from './sessionStore';

/** The path of the open workspace. Only use it inside the workspace screen. */
export function useWorkspacePath(): string {
  const workspacePath = useSession((state) => state.workspacePath);
  if (!workspacePath) throw new Error('No workspace is open.');
  return workspacePath;
}

/**
 * What this window shows (`Place`), for the views that read and change the server's objects, which work the same with
 * or without a workspace. Only use it inside the place's screen.
 */
export function usePlace(): Place {
  const workspacePath = useWorkspacePath();
  return useMemo(() => workspacePlace(workspacePath), [workspacePath]);
}

/** The info of the place's workspace: none for a repository explored without one (the query never runs). */
export function useWorkspaceInfo() {
  return useWorkspaceInfoOf(workspacePathOf(usePlace()));
}

/** `repository` when it isn't the place's (an item under an xlink): see `otherRepository`. */
export function useOtherRepository(repository: string | undefined): string | undefined {
  return otherRepository(repository, usePlaceRepository());
}

/** The repository the window's place reads (`repositoryOfPlace`). */
export function usePlaceRepository(): string | undefined {
  const place = usePlace();
  return repositoryOfPlace(place, useWorkspaceInfoOf(workspacePathOf(place)).data);
}

/** The server of the place's repository (`serverOfPlace`). */
export function usePlaceServer(): string | undefined {
  const place = usePlace();
  return serverOfPlace(place, useWorkspaceInfoOf(workspacePathOf(place)).data);
}

export function workspaceInfoQuery(workspacePath: string) {
  return queryOptions({ queryKey: queryKeys.inWorkspace(workspacePath, 'info'), queryFn: () => api.workspaces.info(workspacePath) });
}

/** Like `useWorkspaceInfo`, for code that also runs without a workspace (null). */
export function useWorkspaceInfoOf(workspacePath: string | null) {
  return useQuery({ ...workspaceInfoQuery(workspacePath ?? ''), enabled: workspacePath !== null });
}

/** Whether a workspace's folder is gone (deleted, moved, or on a drive that isn't mounted). */
export function folderMissingQuery(workspacePath: string) {
  return queryOptions({
    queryKey: queryKeys.inWorkspace(workspacePath, 'folderMissing'),
    queryFn: async () => (await api.workspaces.findMissing([workspacePath])).length > 0,
  });
}

/** Whether the open workspace's folder is gone. */
export function useWorkspaceFolderMissing() {
  return useQuery(folderMissingQuery(useWorkspacePath()));
}
