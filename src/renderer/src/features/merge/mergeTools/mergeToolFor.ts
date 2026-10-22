import {
  AUTO_MERGE_TOOL,
  isUnityYamlMergeId,
  UNITY_YAML_MERGE_NAME,
  unityYamlMergeOf,
  type MergeTool,
  type MergeToolRule,
  type UnityYamlMergeTool,
} from '@shared/domain/mergeTools';
import { matchesAnyFilePattern } from '../../../lib/filePatterns';

/**
 * What opens a conflicting file: a merge tool, or UnityYAMLMerge, without a window, and a tool for what it can't merge
 * (none when no tool was found).
 */
export type Merger = { kind: 'tool'; tool: MergeTool } | { kind: 'unityYamlMerge'; merge: UnityYamlMergeTool; fallback: MergeTool | undefined };

/** What decides how a file merges (Settings › Merge). */
export interface MergeToolSetup {
  tools: MergeTool[];
  /** Every other file's tool (`MergeToolList.preferredId`), and Automatic's. */
  preferredId: string | null;
  rules: readonly MergeToolRule[];
  /** Every Unity Editor's UnityYAMLMerge, the newest first. */
  unityYamlMerges: readonly UnityYamlMergeTool[];
  ignoreCase: boolean;
}

/** A conflicting file, as far as choosing what merges it goes. */
export interface FileToMerge {
  /** From the workspace's root. */
  path: string;
  /**
   * UnityYAMLMerge would run on it: both sides are Unity YAML text and the user decided nothing for it yet
   * (`smartMergeVersions`). Otherwise a rule of UnityYAMLMerge opens its fallback straight away.
   */
  unityYamlMergeable: boolean;
}

/** "UnityYAMLMerge", or the tool's name: what "Resolve in…" names. */
export function mergerName(merger: Merger): string {
  return merger.kind === 'tool' ? merger.tool.name : UNITY_YAML_MERGE_NAME;
}

/** Two mergers are the same: the same tool, or the same editor's UnityYAMLMerge. */
export function sameMerger(a: Merger | undefined, b: Merger | undefined): boolean {
  if (!a || !b) return false;
  if (a.kind === 'tool' && b.kind === 'tool') return a.tool.id === b.tool.id;
  return a.kind === 'unityYamlMerge' && b.kind === 'unityYamlMerge' && a.merge.id === b.merge.id && a.fallback?.id === b.fallback?.id;
}

/**
 * What a file opens in: the first rule whose patterns match it and whose tool is found here, else every other file's
 * tool. A rule of UnityYAMLMerge opens its fallback when UnityYAMLMerge wouldn't run on the file. None when no tool was
 * found.
 */
export function mergeToolFor(file: FileToMerge, setup: MergeToolSetup): Merger | undefined {
  for (const rule of setup.rules) {
    if (!matchesAnyFilePattern(rule.patterns, file.path, setup.ignoreCase)) continue;
    const merger = ruleMerger(rule, setup);
    if (merger) return merger.kind === 'unityYamlMerge' && !file.unityYamlMergeable ? asTool(merger.fallback) : merger;
  }
  return asTool(defaultTool(setup));
}

/**
 * Every other way to open the file this once: each tool but the one it opens in, and, on a file UnityYAMLMerge would
 * run on, the newest editor's UnityYAMLMerge, falling back to the tool the file would open in.
 */
export function otherMergers(file: FileToMerge, own: Merger | undefined, setup: MergeToolSetup): Merger[] {
  const ownTool = own?.kind === 'tool' ? own.tool : undefined;
  const tools: Merger[] = setup.tools.filter((tool) => tool.id !== ownTool?.id).map((tool) => ({ kind: 'tool', tool }));
  const newest = setup.unityYamlMerges[0];
  if (!file.unityYamlMergeable || !newest || own?.kind === 'unityYamlMerge') return tools;
  return [...tools, { kind: 'unityYamlMerge', merge: newest, fallback: ownTool ?? defaultTool(setup) }];
}

/** The rule's merger; none when its tool, or its editor's UnityYAMLMerge, isn't found here. */
function ruleMerger(rule: MergeToolRule, setup: MergeToolSetup): Merger | undefined {
  if (isUnityYamlMergeId(rule.toolId)) {
    const merge = unityYamlMergeOf(setup.unityYamlMerges, rule.toolId);
    return merge && { kind: 'unityYamlMerge', merge, fallback: fallbackTool(rule.fallbackToolId ?? AUTO_MERGE_TOOL, setup) };
  }
  return asTool(toolById(rule.toolId, setup));
}

/** A fallback picked, while it's found here; Automatic's (every other file's tool) otherwise. */
function fallbackTool(toolId: string, setup: MergeToolSetup): MergeTool | undefined {
  return (toolId === AUTO_MERGE_TOOL ? undefined : toolById(toolId, setup)) ?? defaultTool(setup);
}

function defaultTool(setup: MergeToolSetup): MergeTool | undefined {
  return (setup.preferredId ? toolById(setup.preferredId, setup) : undefined) ?? setup.tools[0];
}

function toolById(id: string, setup: MergeToolSetup): MergeTool | undefined {
  return setup.tools.find((tool) => tool.id === id);
}

function asTool(tool: MergeTool | undefined): Merger | undefined {
  return tool && { kind: 'tool', tool };
}
