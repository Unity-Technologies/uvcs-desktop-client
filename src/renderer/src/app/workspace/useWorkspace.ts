import { queryOptions, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { serverOfRepository } from '@shared/domain/permissions';
import { workspacePathOf, workspacePlace, type Place } from '@shared/domain/place';
import { otherRepository } from '@shared/domain/repository';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
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

/**
 * The repository the window's place reads: a repository's own at once; a workspace's once its info is read, undefined
 * until then.
 */
export function usePlaceRepository(): string | undefined {
  const place = usePlace();
  const workspaceRepository = useWorkspaceInfoOf(workspacePathOf(place)).data?.repository;
  return place.kind === 'repository' ? place.repository : workspaceRepository;
}

/** The server of the place's repository: a repository's own at once; a workspace's once its info is read. */
export function usePlaceServer(): string | undefined {
  const place = usePlace();
  const workspaceServer = useWorkspaceInfoOf(workspacePathOf(place)).data?.server;
  return place.kind === 'repository' ? serverOfRepository(place.repository) : workspaceServer;
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
