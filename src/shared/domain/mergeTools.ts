import type { ContentSource } from './content';

/**
 * A three-way merge app the user can resolve a conflicting file in: the UVCS merge tool, a well-known one found on the
 * machine, or one the user added. It opens only when the user asks, on one file.
 */
export interface MergeTool {
  /** `uvcs`, `vscode`, `kdiff3`... for known tools; `custom:<n>` for the user's. */
  id: string;
  name: string;
  origin: 'known' | 'custom';
  /** The program run, found on this machine (or picked by the user). */
  executable: string;
  /**
   * Its arguments for text files, one per element, with `{base}`, `{yours}`, `{incoming}`, `{result}` and
   * `{baseName}`, `{yoursName}`, `{incomingName}`, `{fileName}` replaced for each file. The user's override if any.
   */
  args: string[];
  /** The arguments before the user's override, to offer going back to them. */
  defaultArgs: string[];
  /** Its window can be brought forward while it's open (an app bundle on macOS). */
  canBringToFront: boolean;
  /** Its app's own icon as a data URL, when the OS gives one (macOS and Windows). */
  icon?: string;
}

/**
 * The tools found, with the one every file no rule matches opens in (`preferredId`): the user's choice, or else the
 * UVCS tool, or else the first.
 */
export interface MergeToolList {
  tools: MergeTool[];
  preferredId: string | null;
  /** Every known tool's name by its id, found or not: a rule naming one that isn't here still says which. */
  knownNames: Record<string, string>;
  /** UnityYAMLMerge from each Unity Editor installed, the newest first; none without a Unity Editor. */
  unityYamlMerges: UnityYamlMergeTool[];
}

/** Unity's own name for its merge of scenes, prefabs and other assets (the Unity Manual's "Smart merge"). */
export const UNITY_YAML_MERGE_NAME = 'UnityYAMLMerge';

/**
 * UnityYAMLMerge, the program every Unity Editor ships with (Unity's Smart Merge): it merges scenes, prefabs and other
 * Unity assets by their objects, without a window. A rule picks it like a tool, and a tool opens what it can't merge.
 */
export interface UnityYamlMergeTool {
  /** `unityyamlmerge:6000.3.19f1` (`unityYamlMergeId`), to pin a rule to this editor's. */
  id: string;
  executable: string;
  /** The Unity Editor it comes from, `6000.3.19f1`; empty for an editor installed without Unity Hub. */
  editorVersion: string;
}

/** UnityYAMLMerge from the newest Unity Editor installed, whichever it is at the time. */
export const UNITY_YAML_MERGE_ID = 'unityyamlmerge';

/** UnityYAMLMerge from one Unity Editor, by its version. */
export function unityYamlMergeId(editorVersion: string): string {
  return `${UNITY_YAML_MERGE_ID}:${editorVersion}`;
}

/** The id names UnityYAMLMerge, the newest editor's or one editor's. */
export function isUnityYamlMergeId(id: string): boolean {
  return id === UNITY_YAML_MERGE_ID || id.startsWith(`${UNITY_YAML_MERGE_ID}:`);
}

/** The UnityYAMLMerge an id names among those installed (newest first); none when that editor isn't installed. */
export function unityYamlMergeOf(merges: readonly UnityYamlMergeTool[], id: string): UnityYamlMergeTool | undefined {
  return id === UNITY_YAML_MERGE_ID ? merges[0] : merges.find((merge) => merge.id === id);
}

/** A merge app added by the user; known tools are found, not stored. */
export interface CustomMergeTool {
  id: string;
  name: string;
  executable: string;
  args: string[];
}

/** `auto`: the UVCS merge tool when it's installed, otherwise the first tool found. */
export const AUTO_MERGE_TOOL = 'auto';

/** The UVCS merge tool's semantic merge (the Desktop GUI run as `semanticmerge`): it merges code by its declarations. */
export const SEMANTIC_TOOL_ID = 'semantic';

/**
 * A row of Settings › Merge: a conflicting file whose path matches one of its patterns opens in its tool. Rows are
 * tried in order, the first that matches wins (`mergeToolFor`); a file none matches opens in the `mergeTool` setting's.
 */
export interface MergeToolRule {
  id: string;
  /** `.cs`, `*.prefab`, a path such as `Assets/Data/**` (`matchesFilePattern`). None: the row matches nothing yet. */
  patterns: string[];
  /** A tool id, or UnityYAMLMerge's (`isUnityYamlMergeId`). A rule whose tool isn't found here is passed by. */
  toolId: string;
  /**
   * With UnityYAMLMerge: the tool that opens what it can't merge, `auto` (every other file's) by default. Unused with
   * any other tool.
   */
  fallbackToolId?: string;
}

/** Unity assets Smart Merge can't merge open where every other file would (`unityMergeTool`). */
export const SAME_AS_OTHER_FILES = 'others';

/**
 * The Unity assets UnityYAMLMerge merges, by extension: scenes, prefabs and the assets Unity saves as YAML text. Not
 * `.meta` files: they have no Unity YAML header, so UnityYAMLMerge never runs on them (`isUnityYaml`).
 */
export const UNITY_YAML_PATTERNS = [
  '.unity',
  '.prefab',
  '.asset',
  '.mat',
  '.anim',
  '.controller',
  '.overrideController',
  '.physicMaterial',
  '.lighting',
  '.mixer',
  '.playable',
  '.preset',
  '.spriteatlas',
  '.terrainlayer',
];

/** Unity assets in UnityYAMLMerge, what it can't merge in every other file's tool. */
export const UNITY_YAML_MERGE_RULE: MergeToolRule = { id: 'unity', patterns: UNITY_YAML_PATTERNS, toolId: UNITY_YAML_MERGE_ID, fallbackToolId: AUTO_MERGE_TOOL };

/** C#, Visual Basic and Java in Semantic Merge, as the official client sends them. */
export const SEMANTIC_MERGE_RULE: MergeToolRule = { id: 'semantic', patterns: ['.cs', '.vb', '.java'], toolId: SEMANTIC_TOOL_ID };

/** With nothing imported: Unity assets in UnityYAMLMerge, C#, Visual Basic and Java in Semantic Merge. */
export const DEFAULT_MERGE_TOOL_RULES: MergeToolRule[] = [UNITY_YAML_MERGE_RULE, SEMANTIC_MERGE_RULE];

export interface MergeToolRequest {
  /** Chosen by the caller, to cancel it or bring its window forward while it's open. */
  sessionId: string;
  toolId: string;
  /** The file's workspace path, for its name and extension. */
  path: string;
  base: ContentSource;
  yours: ContentSource;
  incoming: ContentSource;
  /**
   * What the result file holds when the tool opens (the automatic merge with its conflict markers, or what the user
   * decided so far). A result left like this means nothing was resolved.
   */
  startText: string;
  /** How each version is called in the tool's window, e.g. `Yours (/main/task)`. */
  names: { base: string; yours: string; incoming: string };
}

/**
 * A Unity asset for Smart Merge: its three versions as the merge page read them (an empty base when the base revision
 * was an empty file). Chosen by the caller, `sessionId` stops it like a tool's.
 */
export interface SmartMergeRequest {
  sessionId: string;
  /** Which UnityYAMLMerge: `unityyamlmerge` (the newest editor's) or one editor's (`unityYamlMergeId`). */
  toolId: string;
  /** The file's workspace path, for its name and extension. */
  path: string;
  base: string;
  yours: string;
  incoming: string;
}

/**
 * How Smart Merge ended: the merged text when it merged every change; `notMerged` when it left conflicts, couldn't
 * merge the file or there's no Unity Editor here (the merge tool takes over); `stopped` when the user stopped it.
 */
export type SmartMergeOutcome = { kind: 'merged'; text: string } | { kind: 'notMerged' } | { kind: 'stopped' };

/**
 * How it ended, judged by the result file (few tools tell saving from cancelling by their exit code): what the user
 * saved; `unchanged` when the tool closed without saving, or the user stopped waiting; `failed` when it couldn't run.
 */
export type MergeToolOutcome =
  /** A text file saved: its merged text, conflict markers included if the user left some. */
  | { kind: 'resolved'; text: string }
  /** `exitCode` is null when the user stopped waiting; `errorOutput` is the end of what the tool wrote to stderr. */
  | { kind: 'unchanged'; exitCode: number | null; errorOutput: string }
  | { kind: 'failed'; message: string };
