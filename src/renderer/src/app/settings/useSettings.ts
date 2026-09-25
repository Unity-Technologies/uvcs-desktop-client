import { useQuery } from '@tanstack/react-query';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../queryClient';

export function useSettings(): AppSettings {
  const { data } = useQuery({ queryKey: queryKeys.settings, queryFn: () => api.settings.get(), staleTime: Infinity });
  return data ?? DEFAULT_SETTINGS;
}

const updateSettings = (changes: Partial<AppSettings>): void => void saveSettings(changes);

export function useUpdateSettings(): (changes: Partial<AppSettings>) => void {
  return updateSettings;
}

/** Saves settings from anywhere, hooks or not: the change shows right away and the store confirms it. */
export async function saveSettings(changes: Partial<AppSettings>): Promise<void> {
  const current = queryClient.getQueryData<AppSettings>(queryKeys.settings) ?? DEFAULT_SETTINGS;
  queryClient.setQueryData(queryKeys.settings, { ...current, ...changes });
  queryClient.setQueryData(queryKeys.settings, await api.settings.update(changes));
}

/** Remembers a workspace at the top of the recent list, the app's and the OS's. */
export async function rememberRecentWorkspace(workspacePath: string): Promise<void> {
  void api.system.addRecentDocument(workspacePath);
  const settings = await api.settings.get();
  const recentWorkspacePaths = [workspacePath, ...settings.recentWorkspacePaths.filter((path) => path !== workspacePath)].slice(0, 10);
  queryClient.setQueryData(queryKeys.settings, await api.settings.update({ recentWorkspacePaths }));
}

/** Drops a workspace from the recent list, e.g. once it's removed or its folder is gone for good. */
export async function forgetRecentWorkspace(workspacePath: string): Promise<void> {
  const { recentWorkspacePaths } = await api.settings.get();
  const updated = await api.settings.update({ recentWorkspacePaths: recentWorkspacePaths.filter((path) => path !== workspacePath) });
  queryClient.setQueryData(queryKeys.settings, updated);
}
