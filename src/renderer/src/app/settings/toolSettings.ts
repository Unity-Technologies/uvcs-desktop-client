import { ArrowDown, ArrowUp, Copy, Pencil, Trash2 } from 'lucide-react';
import { placeholderValues, toolArgs, type ResolvedSubject } from '@shared/domain/toolArgs';
import { TOOL_PLACEHOLDERS, TOOL_TARGET_LABELS, TOOL_TARGETS, type Tool, type ToolTarget } from '@shared/domain/tools';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { formatArgs, parseArgs } from '../../lib/argumentLine';
import { programName } from '../../lib/programName';
import { moveRule, removeRule } from './mergeToolRules';

/** A row of Settings › Tools: the tool's name, and what it runs on. */
export interface ToolRowView {
  id: string;
  name: string;
  /** "Changesets, branches": its targets in the app's order. */
  runsOn: string;
}

export function toolRows(tools: readonly Tool[]): ToolRowView[] {
  return tools.map((tool) => ({ id: tool.id, name: tool.name, runsOn: runsOnText(tool.targets) }));
}

function runsOnText(targets: readonly ToolTarget[]): string {
  const labels = TOOL_TARGETS.filter((target) => targets.includes(target)).map((target) => TOOL_TARGET_LABELS[target]);
  return labels.map((label, index) => (index === 0 ? label : label.toLowerCase())).join(', ');
}

/** The tools with `tool` saved: an edited one keeps its place, a new one goes last. */
export function withSavedTool(tools: readonly Tool[], tool: Tool): Tool[] {
  return tools.some((saved) => saved.id === tool.id) ? tools.map((saved) => (saved.id === tool.id ? tool : saved)) : [...tools, tool];
}

/** A row's "…" menu: Edit…, Duplicate, Move up and Move down (not past the ends), Remove. */
export function toolRowMenu(tools: readonly Tool[], id: string, edit: () => void, save: (tools: Tool[]) => void, newId: () => string): MenuEntry[] {
  const index = tools.findIndex((tool) => tool.id === id);
  const tool = tools[index];
  if (!tool) return [];
  return [
    { id: 'edit', label: 'Edit…', icon: Pencil, run: edit },
    { id: 'duplicate', label: 'Duplicate', icon: Copy, run: () => save([...tools.slice(0, index + 1), { ...tool, id: newId(), name: `${tool.name} copy` }, ...tools.slice(index + 1)]) },
    SEPARATOR,
    { id: 'moveUp', label: 'Move up', icon: ArrowUp, disabled: index <= 0, run: () => save(moveRule(tools, id, -1)) },
    { id: 'moveDown', label: 'Move down', icon: ArrowDown, disabled: index >= tools.length - 1, run: () => save(moveRule(tools, id, 1)) },
    SEPARATOR,
    { id: 'remove', label: 'Remove', icon: Trash2, danger: true, run: () => save(removeRule(tools, id)) },
  ];
}

/** The edit dialog's fields as they stand, before Save. */
export interface ToolDraft {
  name: string;
  program: string;
  argsText: string;
  targets: ToolTarget[];
}

/** A new tool runs on a changeset by default, its spec the one argument: the official client's most common use. */
export const NEW_TOOL_DRAFT: ToolDraft = { name: '', program: '', argsText: '{object}', targets: ['changeset'] };

export function draftOfTool(tool: Tool): ToolDraft {
  return { name: tool.name, program: tool.program, argsText: formatArgs(tool.args), targets: [...tool.targets] };
}

/** The tool the draft saves as: its name, else its program's. */
export function toolOfDraft(draft: ToolDraft, id: string): Tool {
  const program = draft.program.trim();
  return { id, name: draft.name.trim() || programName(program), program, args: parseArgs(draft.argsText), targets: TOOL_TARGETS.filter((target) => draft.targets.includes(target)) };
}

/** What the Name field shows while empty: the name it saves as (`toolOfDraft`), or an example before a program. */
export function toolNamePlaceholder(draft: ToolDraft): string {
  const program = draft.program.trim();
  return program ? programName(program) : 'Post to tracker';
}

/** Why the draft can't be saved yet; undefined when it can. */
export function toolDraftProblem(draft: ToolDraft): string | undefined {
  if (draft.program.trim() === '') return 'Choose the program it runs.';
  if (draft.targets.length === 0) return 'Choose what it runs on.';
  return undefined;
}

/** The draft's targets with `target` on or off. */
export function withTarget(targets: readonly ToolTarget[], target: ToolTarget, on: boolean): ToolTarget[] {
  return TOOL_TARGETS.filter((candidate) => (candidate === target ? on : targets.includes(candidate)));
}

/** The placeholders the arguments' hint lists, each with what it becomes (its tooltip). */
export const TOOL_PLACEHOLDER_HINTS = Object.entries(TOOL_PLACEHOLDERS).map(([name, meaning]) => ({ name, meaning }));

/**
 * The command the draft would run on an example of its first target, as one line ("post.exe cs:12 game@local"), so
 * the user sees what each placeholder becomes before saving; none without a program or a target.
 */
export function toolPreview(draft: ToolDraft, platform: string): string | undefined {
  const target = TOOL_TARGETS.find((candidate) => draft.targets.includes(candidate));
  if (draft.program.trim() === '' || !target) return undefined;
  const workspacePath = EXAMPLE_WORKSPACES[platform] ?? EXAMPLE_WORKSPACES.linux!;
  const args = toolArgs(parseArgs(draft.argsText), placeholderValues(exampleOf(target, workspacePath, platform), { repository: 'game@local', workspacePath }));
  return [programName(draft.program.trim()), formatArgs(args)].filter(Boolean).join(' ');
}

/** Where each OS's users usually keep a workspace, for the example. */
const EXAMPLE_WORKSPACES: Record<string, string> = { win32: 'C:\\Users\\me\\wkspaces\\game', darwin: '/Users/me/wkspaces/game', linux: '/home/me/wkspaces/game' };

function exampleOf(target: ToolTarget, workspacePath: string, platform: string): ResolvedSubject {
  switch (target) {
    case 'item':
      return { kind: 'item', path: platform === 'win32' ? `${workspacePath}\\src\\Player.cs` : `${workspacePath}/src/Player.cs` };
    case 'changeset':
      return { kind: 'changeset', id: 12, branch: '/main/task' };
    case 'branch':
      return { kind: 'branch', name: '/main/task' };
    case 'label':
      return { kind: 'label', name: 'v1.0' };
  }
}
