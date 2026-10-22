import { ArrowDown, ArrowUp, SlidersHorizontal, Trash2 } from 'lucide-react';
import { AUTO_MERGE_TOOL, SAME_AS_OTHER_FILES, type MergeTool, type MergeToolList, type MergeToolRule, type UnityYamlMergeTool } from '@shared/domain/mergeTools';
import { formatFilePatterns, parseFilePatterns } from '../../lib/filePatterns';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { automaticChoice, type AutomaticChoice, type PickableApp } from './appPickerChoices';

/** What "Automatic" picks for every other file, in its tooltip. */
export const AUTOMATIC_MERGE_TOOL_RULE = "The UVCS merge tool when it's installed, else the first one found";

/** Every other file's tool: "Automatic", or one picked. */
export const AUTOMATIC_MERGE_TOOL_CHOICE: AutomaticChoice = { ...automaticChoice(AUTOMATIC_MERGE_TOOL_RULE), id: AUTO_MERGE_TOOL };

/** Unity assets Smart Merge can't merge: where every other file opens, or one tool picked. */
export const SAME_AS_OTHER_FILES_CHOICE: AutomaticChoice = { id: SAME_AS_OTHER_FILES, label: 'Same as others', rule: 'The tool every other file opens in', coversMissing: false };

export const UNITY_ROW_LABEL = 'Unity scenes, prefabs and assets';

/** The line under the Unity row's name: Smart Merge goes first, or why it doesn't. */
export function unityRowNote(smartMerge: UnityYamlMergeTool | null): string {
  return smartMerge ? 'Smart Merge first' : 'No Unity Editor for Smart Merge';
}

/** The Unity row's tooltip: what Smart Merge does, from which editor, and where the tool comes in. */
export function unityRowTip(smartMerge: UnityYamlMergeTool | null): string {
  const tool = 'The tool opens only what it can’t merge.';
  if (!smartMerge) return `Smart Merge, in every Unity Editor, merges them by their objects. ${tool}`;
  const editor = smartMerge.editorVersion ? `Unity ${smartMerge.editorVersion}` : 'Unity';
  return `Smart Merge (${editor}) merges them by their objects, without opening anything. ${tool}`;
}

/** The merge tools as a picker lists them. */
export function pickableTools(tools: MergeTool[]): PickableApp[] {
  return tools.map((tool) => ({ id: tool.id, name: tool.name, location: tool.executable, icon: tool.icon }));
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

/** The patterns a row's field holds once left, or null when they are the row's already (nothing to save). */
export function changedPatterns(text: string, rule: MergeToolRule): string[] | null {
  const patterns = parseFilePatterns(text);
  return formatFilePatterns(patterns) === formatFilePatterns(rule.patterns) ? null : patterns;
}

/** After a picker's tools, how the tool in use opens ("How Meld opens…"); nothing while none is found. */
export function howItOpensEntries(picked: MergeTool | undefined, open: (tool: MergeTool) => void): MenuEntry[] {
  return picked ? [{ id: 'howItOpens', label: `How ${picked.name} opens…`, icon: SlidersHorizontal, run: () => open(picked) }] : [];
}
