import { ArrowDown, ArrowUp, Boxes, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  AUTO_MERGE_TOOL,
  isUnityYamlMergeId,
  UNITY_YAML_MERGE_ID,
  UNITY_YAML_MERGE_NAME,
  type MergeTool,
  type MergeToolList,
  type MergeToolRule,
  type UnityYamlMergeTool,
} from '@shared/domain/mergeTools';
import { formatFilePatterns } from '../../lib/filePatterns';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { automaticChoice, type AutomaticChoice, type PickableApp } from './appPickerChoices';

/** What "Automatic" picks for every other file, in its tooltip. */
export const AUTOMATIC_MERGE_TOOL_RULE = "The UVCS merge tool when it's installed, else the first one found";

/** Every other file's tool: "Automatic", or one picked. */
export const AUTOMATIC_MERGE_TOOL_CHOICE: AutomaticChoice = { ...automaticChoice(AUTOMATIC_MERGE_TOOL_RULE), id: AUTO_MERGE_TOOL };

/**
 * What a picker lists: the tools found, and, for a row's own tool, UnityYAMLMerge: the newest editor's, then each
 * editor's by its version (Smart Merge, Unity's name for it, in its description).
 */
export function pickableTools(list: MergeToolList, withUnityYamlMerge: boolean): PickableApp[] {
  const tools = list.tools.map((tool) => ({ id: tool.id, name: tool.name, location: tool.executable, icon: tool.icon }));
  const [newest] = list.unityYamlMerges;
  if (!withUnityYamlMerge || !newest) return tools;
  const unityYamlMerge = (id: string, merge: UnityYamlMergeTool, detail: string): PickableApp => ({
    id,
    name: UNITY_YAML_MERGE_NAME,
    location: `Unity's Smart Merge, from ${editorName(merge)}`,
    glyph: Boxes,
    detail,
  });
  return [
    ...tools,
    { ...unityYamlMerge(UNITY_YAML_MERGE_ID, newest, 'Newest editor'), startsGroup: true },
    ...list.unityYamlMerges.filter((merge) => merge.editorVersion).map((merge) => unityYamlMerge(merge.id, merge, merge.editorVersion)),
  ];
}

/** What to call a tool picked that isn't found here: a known tool's name, or UnityYAMLMerge from an editor gone. */
export function missingToolName(list: MergeToolList, id: string): string | undefined {
  return list.knownNames[id] ?? (isUnityYamlMergeId(id) ? UNITY_YAML_MERGE_NAME : undefined);
}

/** A row of UnityYAMLMerge says what opens what it can't merge. */
export function hasFallback(rule: MergeToolRule): boolean {
  return isUnityYamlMergeId(rule.toolId);
}

function editorName(merge: UnityYamlMergeTool): string {
  return merge.editorVersion ? `Unity ${merge.editorVersion}` : 'Unity';
}

/**
 * The tool a row's picker shows in use: the one picked, or, for a choice that picks for the user ("Automatic", "Same as
 * others"), every other file's. None while the one picked isn't found here (but where Automatic stands for it).
 */
export function toolInUse(list: MergeToolList, choice: string, automatic: AutomaticChoice | null): MergeTool | undefined {
  const picked = list.tools.find((tool) => tool.id === choice);
  if (picked || !automatic || (choice !== automatic.id && !automatic.coversMissing)) return picked;
  return list.tools.find((tool) => tool.id === list.preferredId);
}

/** What a row is called, in its picker's and menu's labels: its patterns, or "New file type" before it has any. */
export function ruleName(rule: MergeToolRule): string {
  return formatFilePatterns(rule.patterns) || 'New file type';
}

/** The tool a new row opens in until another is picked: every other file's, else the first found. */
export function newRuleToolId(list: MergeToolList): string {
  return list.preferredId ?? list.tools[0]?.id ?? '';
}

/** A new row, at the end, opening in `toolId` until another is picked; its patterns come next. */
export function addRule(rules: readonly MergeToolRule[], id: string, toolId: string): MergeToolRule[] {
  return [...rules, { id, patterns: [], toolId }];
}

export function removeRule(rules: readonly MergeToolRule[], id: string): MergeToolRule[] {
  return rules.filter((rule) => rule.id !== id);
}

/** The row moved one place up (-1) or down (1): earlier rows win. Nothing moves past the ends. */
export function moveRule(rules: readonly MergeToolRule[], id: string, offset: -1 | 1): MergeToolRule[] {
  const from = rules.findIndex((rule) => rule.id === id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= rules.length) return [...rules];
  const moved = [...rules];
  [moved[from], moved[to]] = [moved[to]!, moved[from]!];
  return moved;
}

export function changeRule(rules: readonly MergeToolRule[], id: string, change: Partial<Omit<MergeToolRule, 'id'>>): MergeToolRule[] {
  return rules.map((rule) => (rule.id === id ? { ...rule, ...change } : rule));
}

/** A row's "…" menu: Move up, Move down (not past the ends), Remove. */
export function ruleMenuEntries(rules: readonly MergeToolRule[], id: string, save: (rules: MergeToolRule[]) => void): MenuEntry[] {
  const index = rules.findIndex((rule) => rule.id === id);
  return [
    { id: 'moveUp', label: 'Move up', icon: ArrowUp, disabled: index <= 0, run: () => save(moveRule(rules, id, -1)) },
    { id: 'moveDown', label: 'Move down', icon: ArrowDown, disabled: index >= rules.length - 1, run: () => save(moveRule(rules, id, 1)) },
    SEPARATOR,
    { id: 'remove', label: 'Remove', icon: Trash2, danger: true, run: () => save(removeRule(rules, id)) },
  ];
}

/** After a picker's tools, how the tool in use opens ("How Meld opens…"); nothing while none is found. */
export function howItOpensEntries(picked: MergeTool | undefined, open: (tool: MergeTool) => void): MenuEntry[] {
  return picked ? [{ id: 'howItOpens', label: `How ${picked.name} opens…`, icon: SlidersHorizontal, run: () => open(picked) }] : [];
}
