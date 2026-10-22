import { AppWindow, Boxes, TriangleAlert } from 'lucide-react';
import {
  AUTO_MERGE_TOOL,
  isUnityYamlMergeId,
  UNITY_YAML_MERGE_ARGS,
  UNITY_YAML_MERGE_ID,
  UNITY_YAML_MERGE_NAME,
  unityYamlMergeOf,
  type MergeTool,
  type MergeToolList,
  type MergeToolRule,
} from '@shared/domain/mergeTools';
import { appIcon } from '../../components/externalApps/appIcon';
import type { Icon } from '../../lib/actions';
import { formatArgs } from '../../lib/argumentLine';
import { formatFilePatterns } from '../../lib/filePatterns';

/** The row of every other file: always last, it can't move nor go. */
export const EVERY_OTHER_FILE = 'everyOtherFile';

/** Characters of file types a row shows, "+N" included, until the files column was measured (`filesBudget`). */
export const DEFAULT_FILES_BUDGET = 24;

/**
 * The characters of file types the files column holds, "+N" included: its width in the code font's characters (`0`'s
 * advance), less one for the gap before the count. One at least: the first file type always shows (the row cuts it).
 */
export function filesBudget(columnWidth: number, charWidth: number): number {
  if (charWidth <= 0) return DEFAULT_FILES_BUDGET;
  return Math.max(1, Math.floor(columnWidth / charWidth) - 1);
}

/** One row of Settings › Merge, read-only and one line: its files on the left, what opens them on the right. */
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
  /** After the name, quieter: the Unity Editor a row pins. */
  toolDetail?: string;
  toolIcon: Icon | undefined;
  /** The tool isn't on this computer: its name steps back, a warning in place of its icon. */
  missing: boolean;
  /** The tool's tooltip: how it's launched, the command line; or why it's missing. */
  toolTip: string;
}

/** The rows: each rule, then every other file. */
export function mergeToolRows(rules: readonly MergeToolRule[], mergeTool: string, list: MergeToolList, budget = DEFAULT_FILES_BUDGET): MergeToolRowView[] {
  const automaticTool = toolById(list, list.preferredId ?? '') ?? list.tools[0];
  return [
    ...rules.map((rule): MergeToolRowView => {
      const { shown, more } = fitFileTypes(rule.patterns, budget);
      return { id: rule.id, files: shown, moreFiles: more, filesTip: formatFilePatterns(rule.patterns), filesAreCode: true, ...toolSide(rule, list, automaticTool) };
    }),
    { id: EVERY_OTHER_FILE, files: 'Every other file', moreFiles: 0, filesAreCode: false, ...everyOtherFileTool(mergeTool, list, automaticTool) },
  ];
}

/** How a program is launched, as one command line: each word quoted where it needs to be. */
export function commandLine(executable: string, args: readonly string[]): string {
  return formatArgs([executable, ...args]);
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

type ToolSide = Pick<MergeToolRowView, 'toolName' | 'toolDetail' | 'toolIcon' | 'missing' | 'toolTip'>;

const NOT_FOUND = 'Not found on this computer';

function toolSide(rule: MergeToolRule, list: MergeToolList, automaticTool: MergeTool | undefined): ToolSide {
  if (isUnityYamlMergeId(rule.toolId)) {
    const merge = unityYamlMergeOf(list.unityYamlMerges, rule.toolId);
    const pinned = rule.toolId === UNITY_YAML_MERGE_ID ? undefined : rule.toolId.slice(UNITY_YAML_MERGE_ID.length + 1);
    if (!merge) return { toolName: UNITY_YAML_MERGE_NAME, toolDetail: pinned, toolIcon: TriangleAlert, missing: true, toolTip: `${NOT_FOUND}: no Unity Editor${pinned ? ` ${pinned}` : ''}` };
    const fallbackId = rule.fallbackToolId ?? AUTO_MERGE_TOOL;
    const fallback = fallbackId === AUTO_MERGE_TOOL ? automaticTool : (toolById(list, fallbackId) ?? automaticTool);
    const toolTip = `${commandLine(merge.executable, UNITY_YAML_MERGE_ARGS)}\nIf it can't merge: ${fallback?.name ?? 'no merge tool found'}`;
    return { toolName: UNITY_YAML_MERGE_NAME, toolDetail: pinned, toolIcon: Boxes, missing: false, toolTip };
  }
  const tool = toolById(list, rule.toolId);
  if (!tool) return { toolName: list.knownNames[rule.toolId] ?? 'A tool removed', toolIcon: TriangleAlert, missing: true, toolTip: NOT_FOUND };
  return toolOf(tool);
}

/** Every other file's tool: the one picked, or the one it resolves to while none is (or the one picked is gone). */
function everyOtherFileTool(mergeTool: string, list: MergeToolList, automaticTool: MergeTool | undefined): ToolSide {
  const tool = toolById(list, mergeTool) ?? automaticTool;
  if (!tool) return { toolName: 'No merge tool found', toolIcon: TriangleAlert, missing: true, toolTip: 'Install a merge tool, or choose a program: "Choose another app…"' };
  return toolOf(tool);
}

function toolOf(tool: MergeTool): ToolSide {
  return { toolName: tool.name, toolIcon: appIcon(tool) ?? AppWindow, missing: false, toolTip: commandLine(tool.executable, tool.args) };
}

function toolById(list: MergeToolList, id: string): MergeTool | undefined {
  return list.tools.find((tool) => tool.id === id);
}
