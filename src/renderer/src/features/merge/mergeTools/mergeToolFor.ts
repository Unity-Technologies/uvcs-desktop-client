import { SAME_AS_OTHER_FILES, type MergeTool, type MergeToolRule } from '@shared/domain/mergeTools';
import { matchesAnyFilePattern } from '../../../lib/filePatterns';

/** What decides which tool a file opens in (Settings › Merge). */
export interface MergeToolSetup {
  tools: MergeTool[];
  /** Every other file's tool (`MergeToolList.preferredId`). */
  preferredId: string | null;
  rules: readonly MergeToolRule[];
  /** Where Unity assets open when Smart Merge can't merge them: `others`, or a tool id. */
  unityMergeTool: string;
  ignoreCase: boolean;
}

/** A conflicting file, as far as choosing its tool goes. */
export interface FileToMerge {
  /** From the workspace's root. */
  path: string;
  /** Both sides are Unity assets, which Smart Merge merges first (`isUnityAsset`). */
  unityAsset: boolean;
}

/**
 * The tool a file opens in: a Unity asset's own tool, if one was picked; else the first rule whose patterns match the
 * file; else every other file's. A rule or pick whose tool isn't found here is passed by. None when no tool was found.
 */
export function mergeToolFor(file: FileToMerge, setup: MergeToolSetup): MergeTool | undefined {
  const found = (id: string): MergeTool | undefined => setup.tools.find((tool) => tool.id === id);
  if (file.unityAsset && setup.unityMergeTool !== SAME_AS_OTHER_FILES) {
    const unityTool = found(setup.unityMergeTool);
    if (unityTool) return unityTool;
  }
  for (const rule of setup.rules) {
    const tool = found(rule.toolId);
    if (tool && matchesAnyFilePattern(rule.patterns, file.path, setup.ignoreCase)) return tool;
  }
  return (setup.preferredId ? found(setup.preferredId) : undefined) ?? setup.tools[0];
}
