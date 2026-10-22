import { AppWindow, Boxes } from 'lucide-react';
import {
  AUTO_MERGE_TOOL,
  isUnityYamlMergeId,
  UNITY_YAML_MERGE_ID,
  UNITY_YAML_MERGE_NAME,
  unityYamlMergeOf,
  type MergeTool,
  type MergeToolList,
  type MergeToolRule,
} from '@shared/domain/mergeTools';
import { appIcon } from '../../components/externalApps/appIcon';
import type { Icon } from '../../lib/actions';
import { formatFilePatterns } from '../../lib/filePatterns';
import { AUTOMATIC_CHOICE_ICON } from './automaticApp';

/** The row of every other file: always last, it can't move nor go. */
export const EVERY_OTHER_FILE = 'everyOtherFile';

/**
 * Characters of file types a row shows, "+N" included: about what the narrowest row has room for in the code font, so
 * the count is never cut (the list before it may be, by the row).
 */
export const FILES_BUDGET = 24;

/** One row of Settings › Merge, read-only: its files on the left, what opens them on the right. */
export interface MergeToolRowView {
  /** The rule's id, or `EVERY_OTHER_FILE`. */
  id: string;
  /** ".unity .prefab .asset", or "Every other file". */
  files: string;
  /** How many file types more than those shown ("+11"); 0 when all show. */
  moreFiles: number;
  /** Every file type, in the row's tooltip. */
  filesTip?: string;
  /** In the code font: file types, not words. */
  filesAreCode: boolean;
  toolName: string;
  toolIcon: Icon | undefined;
  /** Under the tool: what UnityYAMLMerge falls back to, what Automatic uses, or that the tool isn't here. */
  toolNote?: string;
}

/** The rows: each rule, then every other file. */
export function mergeToolRows(rules: readonly MergeToolRule[], mergeTool: string, list: MergeToolList): MergeToolRowView[] {
  const automaticTool = toolById(list, list.preferredId ?? '') ?? list.tools[0];
  return [
    ...rules.map((rule): MergeToolRowView => {
      const { shown, more } = fitFileTypes(rule.patterns, FILES_BUDGET);
      return { id: rule.id, files: shown, moreFiles: more, filesTip: formatFilePatterns(rule.patterns), filesAreCode: true, ...toolSide(rule, list, automaticTool) };
    }),
    { id: EVERY_OTHER_FILE, files: 'Every other file', moreFiles: 0, filesAreCode: false, ...everyOtherFileTool(mergeTool, list, automaticTool) },
  ];
}

/**
 * The file types that fit `budget` characters with their "+N", separated by spaces; always the first, however long
 * (the row cuts it). Patterns with a space show in quotes, as typed.
 */
export function fitFileTypes(patterns: readonly string[], budget: number): { shown: string; more: number } {
  const quoted = patterns.map((pattern) => formatFilePatterns([pattern]));
  let count = quoted.length;
  while (count > 1 && fittedLength(quoted, count) > budget) count--;
  return { shown: quoted.slice(0, count).join(' '), more: quoted.length - count };
}

/** The characters of the first `count` file types and the "+N" of the rest. */
function fittedLength(quoted: readonly string[], count: number): number {
  const rest = quoted.length - count;
  return quoted.slice(0, count).join(' ').length + (rest > 0 ? ` +${rest}`.length : 0);
}

function toolSide(rule: MergeToolRule, list: MergeToolList, automaticTool: MergeTool | undefined): Pick<MergeToolRowView, 'toolName' | 'toolIcon' | 'toolNote'> {
  if (isUnityYamlMergeId(rule.toolId)) {
    const merge = unityYamlMergeOf(list.unityYamlMerges, rule.toolId);
    if (!merge) return { toolName: UNITY_YAML_MERGE_NAME, toolIcon: Boxes, toolNote: 'Not found on this computer' };
    const fallbackId = rule.fallbackToolId ?? AUTO_MERGE_TOOL;
    const fallback = fallbackId === AUTO_MERGE_TOOL ? automaticTool : (toolById(list, fallbackId) ?? automaticTool);
    // A row pinned to one editor says which; the newest editor's needs no saying.
    const notes = [rule.toolId !== UNITY_YAML_MERGE_ID && merge.editorVersion, fallback && `else ${fallback.name}`].filter(Boolean);
    return { toolName: UNITY_YAML_MERGE_NAME, toolIcon: Boxes, toolNote: notes.join(', ') || undefined };
  }
  const tool = toolById(list, rule.toolId);
  if (!tool) return { toolName: list.knownNames[rule.toolId] ?? 'A tool removed', toolIcon: AppWindow, toolNote: 'Not found on this computer' };
  return { toolName: tool.name, toolIcon: appIcon(tool) ?? AppWindow };
}

function everyOtherFileTool(mergeTool: string, list: MergeToolList, automaticTool: MergeTool | undefined): Pick<MergeToolRowView, 'toolName' | 'toolIcon' | 'toolNote'> {
  const picked = mergeTool === AUTO_MERGE_TOOL ? undefined : toolById(list, mergeTool);
  if (picked) return { toolName: picked.name, toolIcon: appIcon(picked) ?? AppWindow };
  return { toolName: 'Automatic', toolIcon: AUTOMATIC_CHOICE_ICON, toolNote: automaticTool?.name ?? 'No merge tool found' };
}

function toolById(list: MergeToolList, id: string): MergeTool | undefined {
  return list.tools.find((tool) => tool.id === id);
}
