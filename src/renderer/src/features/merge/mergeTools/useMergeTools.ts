import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { CustomMergeTool, MergeTool, MergeToolList } from '@shared/domain/mergeTools';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { saveSettings, useSettings } from '../../../app/settings/useSettings';
import { fileNamesIgnoreCase } from '../../../lib/filePatterns';
import { PLATFORM } from '../../../lib/platform';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { mergeToolFor } from './mergeToolFor';
import { isUnityAsset } from './smartMergeVersions';

const NO_TOOLS: MergeToolList = { tools: [], preferredId: null, smartMerge: null, knownNames: {} };

/**
 * The merge tools on offer. Looked for again when the settings about them change, or after a while (one may have been
 * installed meanwhile); finding them only checks a few paths.
 */
export function useMergeTools(): MergeToolList {
  const { mergeTool, customMergeTools, mergeToolArgs } = useSettings();
  const { data = NO_TOOLS } = useQuery({
    queryKey: [...queryKeys.mergeTools, mergeTool, customMergeTools, mergeToolArgs],
    queryFn: () => api.mergeTools.list(),
    staleTime: 60_000,
  });
  return data;
}

/**
 * The tool each conflicting file opens in, by Settings › Merge (`mergeToolFor`): a Unity asset's own, the first rule
 * that matches it, else every other file's. None when no tool was found.
 */
export function useMergeToolFor(): (state: FileConflictState) => MergeTool | undefined {
  const { tools, preferredId } = useMergeTools();
  const { mergeToolRules, unityMergeTool } = useSettings();
  return useCallback(
    (state) =>
      mergeToolFor(
        { path: state.file.path, unityAsset: isUnityAsset(state) },
        { tools, preferredId, rules: mergeToolRules, unityMergeTool, ignoreCase: fileNamesIgnoreCase(PLATFORM) },
      ),
    [tools, preferredId, mergeToolRules, unityMergeTool],
  );
}

/** Makes the tool the one every file no rule names opens in (`auto`: the UVCS merge tool, else the first found). */
export function preferMergeTool(toolId: string): Promise<void> {
  return saveSettings({ mergeTool: toolId });
}

/**
 * Adds the user's tool, to pick it where they want it. Its id once saved; undefined when the store couldn't save it
 * (`saveSettings` then puts the settings back and says so), so no one picks a tool that doesn't exist.
 */
export async function addCustomMergeTool(tool: Omit<CustomMergeTool, 'id'>): Promise<string | undefined> {
  const id = `custom:${Date.now()}`;
  await saveSettings({ customMergeTools: [...currentSettings().customMergeTools, { ...tool, id }] });
  return currentSettings().customMergeTools.some((saved) => saved.id === id) ? id : undefined;
}

/** Removes the user's tool; every file that opened in it opens as if it had never been picked. */
export function removeCustomMergeTool(toolId: string): Promise<void> {
  const { customMergeTools, mergeTool, mergeToolArgs, mergeToolRules, unityMergeTool } = currentSettings();
  const { [toolId]: _dropped, ...otherArgs } = mergeToolArgs;
  return saveSettings({
    customMergeTools: customMergeTools.filter((tool) => tool.id !== toolId),
    mergeToolArgs: otherArgs,
    mergeToolRules: mergeToolRules.filter((rule) => rule.toolId !== toolId),
    ...(mergeTool === toolId && { mergeTool: DEFAULT_SETTINGS.mergeTool }),
    ...(unityMergeTool === toolId && { unityMergeTool: DEFAULT_SETTINGS.unityMergeTool }),
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

export function currentSettings(): AppSettings {
  return queryClient.getQueryData<AppSettings>(queryKeys.settings) ?? DEFAULT_SETTINGS;
}
