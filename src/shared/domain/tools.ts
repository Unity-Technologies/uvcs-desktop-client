import type { RepositoryVersion } from './content';

/**
 * A program the user runs on what they selected, from its menu's "Tools ▸" (docs/features/tools.md): a script that
 * posts a changeset to a tracker, a build of a branch, an upload of a file. It runs only when the user picks it.
 */
export interface Tool {
  id: string;
  name: string;
  /** The program, or the macOS app bundle; `%VAR%` reads an environment variable. */
  program: string;
  /** One argument each, never through a shell, placeholders (`TOOL_PLACEHOLDERS`) filled in. */
  args: string[];
  /** What it runs on; its menu entry shows only where it applies. */
  targets: ToolTarget[];
}

/** Files and folders, on disk or a revision of one; and the server's objects, shelves among them. */
export const TOOL_TARGETS = ['item', 'changeset', 'branch', 'label', 'shelve'] as const;

export type ToolTarget = (typeof TOOL_TARGETS)[number];

/** How each target reads in Settings: "Files and folders", plural, as a checkbox names what it applies to. */
export const TOOL_TARGET_LABELS: Record<ToolTarget, string> = {
  item: 'Files and folders',
  changeset: 'Changesets',
  branch: 'Branches',
  label: 'Labels',
  shelve: 'Shelves',
};

/** What an argument can name, filled in for each object the tool runs on (`toolArgs`); empty where it has none. */
export const TOOL_PLACEHOLDERS = {
  '{object}': 'The object: a full path, cs:12, br:/main, lb:v1.0 or sh:4',
  '{path}': "A file or folder's full path (a revision's, saved to a temp file)",
  '{changeset}': "A changeset's number",
  '{branch}': "A branch's full name, or a changeset's branch",
  '{label}': "A label's name",
  '{shelve}': "A shelve's number",
  '{repository}': 'The repository, as name@server',
  '{workspace}': "The workspace's folder",
} as const;

export type ToolPlaceholder = keyof typeof TOOL_PLACEHOLDERS;

/** What a tool runs on, one process each: as each menu knows it. `repository` when the object says, else the window's. */
export type ToolSubject =
  | { kind: 'item'; path: string; repository?: string }
  /** A revision kept in the repository, saved to a temp file named `fileName` first. */
  | { kind: 'revision'; version: RepositoryVersion; fileName: string; repository?: string }
  | { kind: 'changeset'; id: number; branch?: string; repository?: string }
  | { kind: 'branch'; name: string; repository?: string }
  | { kind: 'label'; name: string; repository?: string }
  | { kind: 'shelve'; id: number; repository?: string };

/** The target a subject is: a revision is a file. */
export function targetOf(subject: ToolSubject): ToolTarget {
  return subject.kind === 'revision' ? 'item' : subject.kind;
}

/** The tools for these subjects, in the user's order: those that apply to every one of them. */
export function toolsFor(tools: readonly Tool[], subjects: readonly ToolSubject[]): Tool[] {
  if (subjects.length === 0) return [];
  const targets = new Set(subjects.map(targetOf));
  return tools.filter((tool) => [...targets].every((target) => tool.targets.includes(target)));
}

/** Past this many objects a tool asks first: one process each. */
export const TOOL_RUNS_WITHOUT_ASKING = 20;
