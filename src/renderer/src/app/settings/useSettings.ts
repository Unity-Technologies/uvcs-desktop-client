import { queryOptions, useQuery } from '@tanstack/react-query';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { toast } from '../../ui/toast/toastStore';
import { queryClient } from '../queryClient';

export const settingsQuery = queryOptions({ queryKey: queryKeys.settings, queryFn: () => api.settings.get(), staleTime: Infinity });

export function useSettings(): AppSettings {
  const { data } = useQuery(settingsQuery);
  return data ?? DEFAULT_SETTINGS;
}

const updateSettings = (changes: Partial<AppSettings>): void => void saveSettings(changes);

export function useUpdateSettings(): (changes: Partial<AppSettings>) => void {
  return updateSettings;
}

/**
 * Saves settings from anywhere, hooks or not: the change shows right away and the store confirms it. A change the
 * store couldn't save goes back to what was shown before, and says so.
 */
export async function saveSettings(changes: Partial<AppSettings>): Promise<void> {
  const current = queryClient.getQueryData<AppSettings>(queryKeys.settings) ?? DEFAULT_SETTINGS;
  queryClient.setQueryData(queryKeys.settings, { ...current, ...changes });
  try {
    queryClient.setQueryData(queryKeys.settings, await api.settings.update(changes));
  } catch (error) {
    queryClient.setQueryData(queryKeys.settings, current);
    toast.error("Couldn't save the settings", error);
  }
}

/** Keeps this window's settings in step with the changes other windows (and the main process) make. */
export function useSettingsFromOtherWindows(): void {
  useUvcsEvent('settingsChanged', (settings) => queryClient.setQueryData(queryKeys.settings, settings));
}

/** Remembers a workspace at the top of the recent list, the app's and the OS's. */
export async function rememberRecentWorkspace(workspacePath: string): Promise<void> {
  void api.system.addRecentDocument(workspacePath);
  queryClient.setQueryData(queryKeys.settings, await api.settings.rememberRecentWorkspace(workspacePath));
}

/** Drops a workspace from the recent list, e.g. once it's removed or its folder is gone for good. */
export async function forgetRecentWorkspace(workspacePath: string): Promise<void> {
  queryClient.setQueryData(queryKeys.settings, await api.settings.forgetRecentWorkspace(workspacePath));
}
