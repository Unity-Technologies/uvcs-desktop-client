import type { WorkspaceKind } from '@shared/domain/workspace';

export interface WorkspaceKindWords {
  label: string;
  /** What the kind means for the user's files, in a tooltip. */
  description: string;
}

const WORKSPACE_KIND_WORDS: Record<WorkspaceKind, WorkspaceKindWords> = {
  standard: { label: 'Standard', description: 'Holds every file of the branch or changeset it is on' },
  partial: { label: 'Partial', description: 'Holds only the files and folders chosen for it' },
  dynamic: { label: 'Dynamic', description: 'Downloads each file the first time it is opened' },
};

/** How a workspace's kind is named wherever it is shown (the workspace's details say it for every kind). */
export function workspaceKindWords(kind: WorkspaceKind): WorkspaceKindWords {
  return WORKSPACE_KIND_WORDS[kind];
}

/** A kind a workspace's row or card marks, with a chip and its avatar's badge: every kind but standard. */
export type MarkedWorkspaceKind = Exclude<WorkspaceKind, 'standard'>;

/**
 * The kind a workspace's row or card marks: none for a standard workspace, the way most are, nor while its kind is
 * still unread, so only the workspaces that hold their files another way stand out.
 */
export function markedWorkspaceKind(kind: WorkspaceKind | undefined): MarkedWorkspaceKind | null {
  return kind === undefined || kind === 'standard' ? null : kind;
}

/**
 * The kind a workspace's row tells, on its avatar and its chip: none for a missing workspace, whose folder is gone and
 * whose row shows that instead, so its kind as last read isn't claimed for a folder that no longer holds it.
 */
export function shownWorkspaceKind(kind: WorkspaceKind | undefined, missing: boolean): WorkspaceKind | undefined {
  return missing ? undefined : kind;
}

/** The chip a workspace's row or card shows for its kind, when it marks it (`markedWorkspaceKind`). */
export function workspaceKindChip(kind: WorkspaceKind | undefined): WorkspaceKindWords | null {
  const marked = markedWorkspaceKind(kind);
  return marked && WORKSPACE_KIND_WORDS[marked];
}

/**
 * The tooltip of the top bar's workspace (`WorkspacePill`), all it shows in a narrow window: its name and repository,
 * and its kind when not standard; below, where it is on disk.
 */
export function workspacePillTip(workspace: { name: string; repository: string; path: string; kind?: WorkspaceKind }): {
  text: string;
  sub: string;
} {
  const chip = workspaceKindChip(workspace.kind);
  const text = [workspace.name, workspace.repository, chip && `${chip.label} workspace`].filter(Boolean).join(' · ');
  return { text, sub: workspace.path };
}
