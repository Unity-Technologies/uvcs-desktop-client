import { Boxes } from 'lucide-react';
import {
  AUTO_MERGE_TOOL,
  isUnityYamlMergeId,
  editorVersionOf,
  SEMANTIC_TOOL_ID,
  UNITY_YAML_MERGE_ID,
  UNITY_YAML_MERGE_NAME,
  unityYamlMergeOf,
  UVCS_TOOL_ID,
  type MergeTool,
  type MergeToolList,
  type MergeToolRule,
} from '@shared/domain/mergeTools';
import { formatArgs, parseArgs } from '../../lib/argumentLine';
import { addTokens, allTokens } from '../../lib/tokenInput';
import { hasOwnArgsToGoBackTo, mergeToolArgsProblem } from '../../features/merge/mergeTools/mergeToolArgs';
import { NOT_FOUND_HERE, type PickableApp } from './appPickerChoices';
import { missingToolName } from './mergeToolRows';

/** What the edit dialog edits: a rule (none yet for a new one), or every other file's tool. */
export type RuleTarget = { kind: 'rule'; rule: MergeToolRule | null } | { kind: 'everyOtherFile'; mergeTool: string };

/** The dialog's fields as they stand, before Save. */
export interface RuleDraft {
  patterns: string[];
  /**
   * The tool as stored: a tool id, `unityyamlmerge` for UnityYAMLMerge (whichever editor's), or `auto` while every
   * other file's isn't picked yet (the dialog shows the tool it resolves to, `shownTool`).
   */
  toolId: string;
  /** With UnityYAMLMerge: `unityyamlmerge` (the newest installed) or one editor's (`unityYamlMergeId`). */
  editorId: string;
  /** With UnityYAMLMerge: what opens what it can't merge, as stored (`auto`: not picked yet). */
  fallbackToolId: string;
  /** The arguments typed for the tool shown; null while untouched (its own stay). */
  argsText: string | null;
  /** Typed in "Files" but not a chip yet (`TokenField`'s pending text): it counts, and Save makes it chips. */
  pendingFiles: string;
}

/** "How <tool> opens": the arguments of the tool shown, edited in place; stored per tool, wherever it opens. */
export interface ArgsField {
  tool: MergeTool;
  text: string;
  /** Why they can't be saved: no `{result}`. */
  problem: string | undefined;
  /** A known tool whose arguments differ from its own: "Back to its own arguments". */
  canGoBack: boolean;
  /**
   * A tool the user added: "Remove <tool>", and what it does (its tooltip). It removes the tool everywhere, the rows
   * that open in it this one too, so the dialog closes with it.
   */
  remove: { label: string; tip: string } | undefined;
}

/** What the dialog shows for the draft. */
export interface DraftFields {
  title: string;
  files: boolean;
  /** The tool "Opens in" shows: the one stored, or the one it resolves to; none when no tool was found. */
  shownToolId: string | null;
  /** Under "Files": what's missing to save, or what the field takes. */
  filesHint: string;
  /** "Unity Editor" and "If it can't merge": only for UnityYAMLMerge. */
  unityYamlMerge: boolean;
  /** What "Opens in" calls its tool when it isn't here (`missingToolName`). */
  toolMissingName: string;
  /** The tool "If it can't merge" shows. */
  shownFallbackId: string | null;
  fallbackMissingName: string;
  /** None for UnityYAMLMerge (its arguments are fixed), or with no tool found. */
  args: ArgsField | undefined;
}

const NO_FILE_TYPE = 'Add at least one file type';

/** The draft a target starts from: a new rule in every other file's tool, else as the rule or the setting is. */
export function draftOf(target: RuleTarget, list: MergeToolList): RuleDraft {
  const unset = { editorId: UNITY_YAML_MERGE_ID, fallbackToolId: AUTO_MERGE_TOOL, argsText: null, pendingFiles: '' };
  if (target.kind === 'everyOtherFile') return { patterns: [], toolId: target.mergeTool, ...unset };
  const { rule } = target;
  if (!rule) return { patterns: [], toolId: resolvedToolId(AUTO_MERGE_TOOL, list) ?? '', ...unset };
  const unity = isUnityYamlMergeId(rule.toolId);
  return {
    // Each once, as the chips hold them (a rule written by hand, or imported, may repeat one).
    patterns: addTokens([], rule.patterns),
    toolId: unity ? UNITY_YAML_MERGE_ID : rule.toolId,
    editorId: unity ? rule.toolId : UNITY_YAML_MERGE_ID,
    fallbackToolId: rule.fallbackToolId ?? AUTO_MERGE_TOOL,
    argsText: null,
    pendingFiles: '',
  };
}

/** The file types the draft holds: its chips, and what's typed but not a chip yet. */
export function draftPatterns(draft: RuleDraft): string[] {
  return addTokens(draft.patterns, allTokens(draft.pendingFiles));
}

/** The draft with another tool picked: its own arguments show. */
export function withTool(draft: RuleDraft, toolId: string): RuleDraft {
  return { ...draft, toolId, argsText: null };
}

/** The rule the draft saves as, under `id`; a fallback only with UnityYAMLMerge. */
export function ruleOf(draft: RuleDraft, id: string): MergeToolRule {
  const patterns = draftPatterns(draft);
  if (draft.toolId !== UNITY_YAML_MERGE_ID) return { id, patterns, toolId: draft.toolId };
  return { id, patterns, toolId: draft.editorId, fallbackToolId: draft.fallbackToolId };
}

/** The rules with this one in its place, or last when it's new. */
export function withRule(rules: readonly MergeToolRule[], rule: MergeToolRule): MergeToolRule[] {
  return rules.some((other) => other.id === rule.id) ? rules.map((other) => (other.id === rule.id ? rule : other)) : [...rules, rule];
}

/**
 * The tool a stored id stands for: itself while it's found, else the one every other file falls back to (the UVCS
 * merge tool, else the first found: `MergeToolList.preferredId`). Null when no tool was found.
 */
export function resolvedToolId(toolId: string, list: MergeToolList): string | null {
  if (toolId === UNITY_YAML_MERGE_ID || list.tools.some((tool) => tool.id === toolId)) return toolId;
  return list.preferredId ?? list.tools[0]?.id ?? null;
}

export function draftFields(target: RuleTarget, draft: RuleDraft, list: MergeToolList): DraftFields {
  const rule = target.kind === 'rule';
  // A rule's own tool shows as picked, found or not (a row whose tool is gone is passed by); only `auto` resolves.
  const shownToolId = rule && draft.toolId !== AUTO_MERGE_TOOL ? draft.toolId : resolvedToolId(draft.toolId, list);
  const unityYamlMerge = rule && draft.toolId === UNITY_YAML_MERGE_ID;
  const tool = list.tools.find((candidate) => candidate.id === shownToolId);
  const shownFallbackId = resolvedToolId(draft.fallbackToolId, list);
  return {
    title: rule ? 'File types' : 'Every other file',
    files: rule,
    filesHint: draftPatterns(draft).length === 0 ? NO_FILE_TYPE : 'Extensions, names or paths. Enter, a space or a comma adds one.',
    shownToolId,
    toolMissingName: missingToolName(shownToolId, list),
    unityYamlMerge,
    shownFallbackId,
    fallbackMissingName: missingToolName(shownFallbackId, list),
    args: tool && !unityYamlMerge ? argsFieldOf(tool, draft.argsText) : undefined,
  };
}

/**
 * What Save stores: a rule names a real tool, the one shown when it was still `auto`; any id picked stays as picked,
 * even one the list doesn't hold yet (a tool just added). Every other file keeps `auto` until one is picked.
 */
export function savedDraft(target: RuleTarget, draft: RuleDraft, fields: DraftFields): RuleDraft {
  return target.kind === 'rule' && draft.toolId === AUTO_MERGE_TOOL && fields.shownToolId ? { ...draft, toolId: fields.shownToolId } : draft;
}

/** The tools found, with those added from the dialog that the list doesn't hold yet (it's fetched again meanwhile). */
export function withAddedTools(list: MergeToolList, added: readonly MergeTool[]): MergeToolList {
  const missing = added.filter((tool) => !list.tools.some((found) => found.id === tool.id));
  return missing.length === 0 ? list : { ...list, tools: [...list.tools, ...missing] };
}

/** The arguments to save with the draft: the tool's, when they were edited into something else; none otherwise. */
export function argsToSave(fields: DraftFields): { tool: MergeTool; args: string[] } | undefined {
  const args = fields.args && parseArgs(fields.args.text);
  if (!fields.args || !args || args.join('\0') === fields.args.tool.args.join('\0')) return undefined;
  return { tool: fields.args.tool, args };
}

/** Why Save can't save yet: a rule names at least one file type, and the arguments save the merge somewhere. */
export function saveProblem(target: RuleTarget, draft: RuleDraft, fields: DraftFields): string | undefined {
  if (target.kind === 'rule' && draftPatterns(draft).length === 0) return NO_FILE_TYPE;
  return fields.args?.problem;
}

/**
 * "Opens in"'s tools, each once: the UVCS merge tool, Semantic Merge, UnityYAMLMerge (for a rule, when a Unity Editor
 * is installed; Smart Merge in its tooltip), then the others found and the user's. Each shows the path of the program
 * that runs, UnityYAMLMerge the one of the Unity Editor picked (`editorId`).
 */
export function toolChoices(target: RuleTarget, list: MergeToolList, editorId: string): PickableApp[] {
  const tools = list.tools.map(pickable);
  if (target.kind !== 'rule' || list.unityYamlMerges.length === 0) return tools;
  const unityYamlMerge: PickableApp = {
    id: UNITY_YAML_MERGE_ID,
    name: UNITY_YAML_MERGE_NAME,
    location: unityYamlMergeOf(list.unityYamlMerges, editorId)?.executable ?? NOT_FOUND_HERE,
    glyph: Boxes,
    tip: "Unity's Smart Merge: it merges scenes, prefabs and other assets by their objects, without a window",
  };
  const after = Math.max(...[UVCS_TOOL_ID, SEMANTIC_TOOL_ID].map((id) => tools.findIndex((tool) => tool.id === id))) + 1;
  return [...tools.slice(0, after), unityYamlMerge, ...tools.slice(after)];
}

/** "If it can't merge"'s tools: those that open a window. */
export function fallbackChoices(list: MergeToolList): PickableApp[] {
  return list.tools.map(pickable);
}

export interface EditorOption {
  value: string;
  label: string;
}

/**
 * "Unity Editor": the newest installed first ("Newest installed (6000.5.0f1)"), then each installed version; one picked
 * that isn't installed anymore stays, saying so.
 */
export function editorOptions(list: MergeToolList, editorId: string): EditorOption[] {
  const [newest] = list.unityYamlMerges;
  const options = [
    { value: UNITY_YAML_MERGE_ID, label: newest?.editorVersion ? `Newest installed (${newest.editorVersion})` : 'Newest installed' },
    ...list.unityYamlMerges.filter((merge) => merge.editorVersion).map((merge) => ({ value: merge.id, label: merge.editorVersion })),
  ];
  if (editorId === UNITY_YAML_MERGE_ID || unityYamlMergeOf(list.unityYamlMerges, editorId)) return options;
  return [...options, { value: editorId, label: `${editorVersionOf(editorId) ?? editorId} (${NOT_FOUND_HERE.toLowerCase()})` }];
}

function argsFieldOf(tool: MergeTool, argsText: string | null): ArgsField {
  const text = argsText ?? formatArgs(tool.args);
  const args = parseArgs(text);
  return {
    tool,
    text,
    problem: mergeToolArgsProblem(args),
    canGoBack: hasOwnArgsToGoBackTo({ ...tool, args }),
    remove: tool.origin === 'custom' ? { label: `Remove ${tool.name}`, tip: `Removes ${tool.name}, and every row that opens in it` } : undefined,
  };
}

function pickable(tool: MergeTool): PickableApp {
  return { id: tool.id, name: tool.name, location: tool.executable, icon: tool.icon };
}
