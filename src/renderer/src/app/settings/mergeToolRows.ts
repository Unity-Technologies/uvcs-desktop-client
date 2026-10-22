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
import type { RuleTarget } from './mergeRuleDraft';

/** The row of every other file: always last, it can't move nor go. */
export const EVERY_OTHER_FILE = 'everyOtherFile';

/** Whether a row's files text fits its column: measured in the code font (`useFilesFit`), else by a guess. */
export type FitsColumn = (text: string) => boolean;

/** Until the files column is measured: about what the narrowest row holds. */
export const GUESSED_FIT: FitsColumn = (text) => text.length <= 24;

/** Fits a column `width` pixels wide, by the text's measured width. */
export function fitsWidth(width: number, widthOf: (text: string) => number): FitsColumn {
  return (text) => widthOf(text) <= width;
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
  /** For screen readers: the row's every file type and tool, and that it edits ("….cs .vb: Semantic Merge. Edit"). */
  label: string;
  /** Its "…" button's, naming the row by its file types. */
  menuLabel: string;
}

/** The rows: each rule, then every other file. */
export function mergeToolRows(rules: readonly MergeToolRule[], mergeTool: string, list: MergeToolList, fits: FitsColumn = GUESSED_FIT): MergeToolRowView[] {
  const automaticTool = toolById(list, list.preferredId ?? '') ?? list.tools[0];
  return [
    ...rules.map((rule): MergeToolRowView => {
      const { shown, more } = fitFileTypes(rule.patterns, fits);
      return labeled({ id: rule.id, files: shown, moreFiles: more, filesTip: formatFilePatterns(rule.patterns), filesAreCode: true, ...toolSide(rule, list, automaticTool) });
    }),
    labeled({ id: EVERY_OTHER_FILE, files: 'Every other file', moreFiles: 0, filesAreCode: false, ...everyOtherFileTool(mergeTool, list, automaticTool) }),
  ];
}

/** What a row edits: its rule, or every other file's tool. */
export function rowTarget(id: string, rules: readonly MergeToolRule[], mergeTool: string): RuleTarget {
  return id === EVERY_OTHER_FILE ? { kind: 'everyOtherFile', mergeTool } : { kind: 'rule', rule: rules.find((rule) => rule.id === id) ?? null };
}

function labeled(row: Omit<MergeToolRowView, 'label' | 'menuLabel'>): MergeToolRowView {
  const files = row.filesTip ?? row.files;
  return { ...row, label: `${files}: ${row.toolName}. Edit`, menuLabel: `More for ${files}` };
}

/** What every other file's row and pickers say when no merge tool was found at all. */
export const NO_MERGE_TOOL = 'No merge tool found';

/**
 * What a tool picked that isn't here is called: UnityYAMLMerge by its id (no Unity Editor, or not that one), a known
 * tool by its name, a tool of the user's removed since as such; with nothing picked, that no tool was found.
 */
export function missingToolName(toolId: string | null, list: MergeToolList): string {
  if (!toolId) return NO_MERGE_TOOL;
  if (isUnityYamlMergeId(toolId)) return UNITY_YAML_MERGE_NAME;
  return list.knownNames[toolId] ?? 'A tool removed';
}

/** How a program is launched, as one command line: each word quoted where it needs to be. */
export function commandLine(executable: string, args: readonly string[]): string {
  return formatArgs([executable, ...args]);
}

/**
 * The file types that fit the column with their "+N", as the row draws them: `.unity .prefab +12`, the count after a
 * space. Always the first, however long (the row cuts it). Patterns with a space show in quotes, as typed.
 */
export function fitFileTypes(patterns: readonly string[], fits: FitsColumn): { shown: string; more: number } {
  const quoted = patterns.map((pattern) => formatFilePatterns([pattern]));
  let count = quoted.length;
  while (count > 1 && !fits(rowText(quoted, count))) count--;
  return { shown: quoted.slice(0, count).join(' '), more: quoted.length - count };
}

/** The row's text with the first `count` file types: them, then " +N" for the rest. */
function rowText(quoted: readonly string[], count: number): string {
  const rest = quoted.length - count;
  return quoted.slice(0, count).join(' ') + (rest > 0 ? ` +${rest}` : '');
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
  if (!tool) return { toolName: missingToolName(rule.toolId, list), toolIcon: TriangleAlert, missing: true, toolTip: NOT_FOUND };
  return toolOf(tool);
}

/** Every other file's tool: the one picked, or the one it resolves to while none is (or the one picked is gone). */
function everyOtherFileTool(mergeTool: string, list: MergeToolList, automaticTool: MergeTool | undefined): ToolSide {
  const tool = toolById(list, mergeTool) ?? automaticTool;
  if (!tool) return { toolName: NO_MERGE_TOOL, toolIcon: TriangleAlert, missing: true, toolTip: 'Install a merge tool, or choose a program: "Choose another app…"' };
  return toolOf(tool);
}

function toolOf(tool: MergeTool): ToolSide {
  return { toolName: tool.name, toolIcon: appIcon(tool) ?? AppWindow, missing: false, toolTip: commandLine(tool.executable, tool.args) };
}

function toolById(list: MergeToolList, id: string): MergeTool | undefined {
  return list.tools.find((tool) => tool.id === id);
}
