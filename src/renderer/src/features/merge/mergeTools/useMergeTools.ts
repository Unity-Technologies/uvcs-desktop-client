import { useQuery } from '@tanstack/react-query';
import type { CustomMergeTool, MergeTool, MergeToolList } from '@shared/domain/mergeTools';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { saveSettings, useSettings } from '../../../app/settings/useSettings';

const NO_TOOLS: MergeToolList = { tools: [], preferredId: null };

/**
 * The merge tools on offer. Looked for again when the settings about them change, or after a while (one may have been
 * installed meanwhile); finding them only checks a few paths.
 */
export function useMergeTools(): MergeToolList & { preferred: MergeTool | undefined } {
  const { mergeTool, customMergeTools, mergeToolArgs } = useSettings();
  const { data = NO_TOOLS } = useQuery({
    queryKey: [...queryKeys.mergeTools, mergeTool, customMergeTools, mergeToolArgs],
    queryFn: () => api.mergeTools.list(),
    staleTime: 60_000,
  });
  return { ...data, preferred: data.tools.find((tool) => tool.id === data.preferredId) };
}

/** Makes the tool the one "Resolve in…" opens. */
export function preferMergeTool(toolId: string): Promise<void> {
  return saveSettings({ mergeTool: toolId });
}

export async function addCustomMergeTool(tool: Omit<CustomMergeTool, 'id'>): Promise<string> {
  const id = `custom:${Date.now()}`;
  await saveSettings({ customMergeTools: [...currentSettings().customMergeTools, { ...tool, id }], mergeTool: id });
  return id;
}

export function removeCustomMergeTool(toolId: string): Promise<void> {
  const { customMergeTools, mergeTool, mergeToolArgs } = currentSettings();
  const { [toolId]: _dropped, ...otherArgs } = mergeToolArgs;
  return saveSettings({
    customMergeTools: customMergeTools.filter((tool) => tool.id !== toolId),
    mergeToolArgs: otherArgs,
    ...(mergeTool === toolId && { mergeTool: DEFAULT_SETTINGS.mergeTool }),
  });
}

/** The user's arguments for a tool; null goes back to its own. */
export function setMergeToolArgs(tool: MergeTool, args: string[] | null): Promise<void> {
  const { [tool.id]: _replaced, ...otherArgs } = currentSettings().mergeToolArgs;
  if (tool.origin === 'custom') {
    return saveSettings({ customMergeTools: currentSettings().customMergeTools.map((custom) => (custom.id === tool.id ? { ...custom, args: args ?? custom.args } : custom)) });
  }
  const unchanged = !args || args.join('\0') === tool.defaultArgs.join('\0');
  return saveSettings({ mergeToolArgs: unchanged ? otherArgs : { ...otherArgs, [tool.id]: args } });
}

function currentSettings(): AppSettings {
  return queryClient.getQueryData<AppSettings>(queryKeys.settings) ?? DEFAULT_SETTINGS;
}
