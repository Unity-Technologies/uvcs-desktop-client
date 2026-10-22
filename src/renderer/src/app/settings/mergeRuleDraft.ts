import { Boxes } from 'lucide-react';
import {
  AUTO_MERGE_TOOL,
  isUnityYamlMergeId,
  SEMANTIC_TOOL_ID,
  UNITY_YAML_MERGE_ID,
  UNITY_YAML_MERGE_NAME,
  unityYamlMergeOf,
  type MergeTool,
  type MergeToolList,
  type MergeToolRule,
} from '@shared/domain/mergeTools';
import type { PickableApp } from './appPickerChoices';

/** What the edit dialog edits: a rule (none yet for a new one), or every other file's tool. */
export type RuleTarget = { kind: 'rule'; rule: MergeToolRule | null } | { kind: 'everyOtherFile'; mergeTool: string };

/** The dialog's fields as they stand, before Save. */
export interface RuleDraft {
  patterns: string[];
  /** A tool id; `unityyamlmerge` for UnityYAMLMerge, whichever editor's; `auto` for every other file's Automatic. */
  toolId: string;
  /** With UnityYAMLMerge: `unityyamlmerge` (the newest installed) or one editor's (`unityYamlMergeId`). */
  editorId: string;
  /** With UnityYAMLMerge: what opens what it can't merge, `auto` by default. */
  fallbackToolId: string;
}

/** What the dialog shows for the draft: the fields that apply, and how the picked tool opens. */
export interface DraftFields {
  title: string;
  files: boolean;
  /** "Unity Editor" and "If it can't merge": only for UnityYAMLMerge. */
  unityYamlMerge: boolean;
  /** "Opens in" offers Automatic: every other file's row only. */
  automatic: boolean;
  /** The tool whose arguments "How <tool> opens…" edits: a tool found here, not UnityYAMLMerge nor Automatic. */
  howItOpens: MergeTool | undefined;
}

/** The draft a target starts from: a new rule in every other file's tool, else as the rule or the setting is. */
export function draftOf(target: RuleTarget, list: MergeToolList): RuleDraft {
  const unset = { editorId: UNITY_YAML_MERGE_ID, fallbackToolId: AUTO_MERGE_TOOL };
  if (target.kind === 'everyOtherFile') return { patterns: [], toolId: target.mergeTool, ...unset };
  const { rule } = target;
  if (!rule) return { patterns: [], toolId: list.preferredId ?? list.tools[0]?.id ?? '', ...unset };
  const unity = isUnityYamlMergeId(rule.toolId);
  return {
    patterns: rule.patterns,
    toolId: unity ? UNITY_YAML_MERGE_ID : rule.toolId,
    editorId: unity ? rule.toolId : UNITY_YAML_MERGE_ID,
    fallbackToolId: rule.fallbackToolId ?? AUTO_MERGE_TOOL,
  };
}

/** The rule the draft saves as, under `id`; a fallback only with UnityYAMLMerge. */
export function ruleOf(draft: RuleDraft, id: string): MergeToolRule {
  if (draft.toolId !== UNITY_YAML_MERGE_ID) return { id, patterns: draft.patterns, toolId: draft.toolId };
  return { id, patterns: draft.patterns, toolId: draft.editorId, fallbackToolId: draft.fallbackToolId };
}

/** The rules with this one in its place, or last when it's new. */
export function withRule(rules: readonly MergeToolRule[], rule: MergeToolRule): MergeToolRule[] {
  return rules.some((other) => other.id === rule.id) ? rules.map((other) => (other.id === rule.id ? rule : other)) : [...rules, rule];
}

export function draftFields(target: RuleTarget, draft: RuleDraft, list: MergeToolList): DraftFields {
  const rule = target.kind === 'rule';
  return {
    title: rule ? 'File types' : 'Every other file',
    files: rule,
    unityYamlMerge: rule && draft.toolId === UNITY_YAML_MERGE_ID,
    automatic: !rule,
    howItOpens: list.tools.find((tool) => tool.id === draft.toolId),
  };
}

/** Why Save can't save yet: a rule names at least one file type. */
export function saveProblem(target: RuleTarget, draft: RuleDraft): string | undefined {
  return target.kind === 'rule' && draft.patterns.length === 0 ? 'Add at least one file type' : undefined;
}

/**
 * "Opens in"'s tools, each once: the UVCS merge tool, Semantic Merge, UnityYAMLMerge (for a rule, when a Unity Editor
 * is installed: the newest one's version under it, Smart Merge in its tooltip), then the others found and the user's.
 */
export function toolChoices(target: RuleTarget, list: MergeToolList): PickableApp[] {
  const tools = list.tools.map(pickable);
  const [newest] = list.unityYamlMerges;
  if (target.kind !== 'rule' || !newest) return tools;
  const unityYamlMerge: PickableApp = {
    id: UNITY_YAML_MERGE_ID,
    name: UNITY_YAML_MERGE_NAME,
    location: newest.editorVersion ? `Unity ${newest.editorVersion}` : 'Unity',
    glyph: Boxes,
    tip: "Unity's Smart Merge: it merges scenes, prefabs and other assets by their objects, without a window",
  };
  const after = Math.max(...['uvcs', SEMANTIC_TOOL_ID].map((id) => tools.findIndex((tool) => tool.id === id))) + 1;
  return [...tools.slice(0, after), unityYamlMerge, ...tools.slice(after)];
}

/** "If it can't merge"'s tools: those that open a window, Automatic first (the picker adds it). */
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
  return [...options, { value: editorId, label: `${editorId.slice(UNITY_YAML_MERGE_ID.length + 1)} (not found on this computer)` }];
}

function pickable(tool: MergeTool): PickableApp {
  return { id: tool.id, name: tool.name, location: tool.executable, icon: tool.icon };
}
