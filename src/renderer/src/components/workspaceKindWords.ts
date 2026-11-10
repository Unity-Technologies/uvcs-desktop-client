import type { WorkspaceKind } from '@shared/domain/workspace';

export interface WorkspaceKindWords {
  label: string;
  /** What the kind means for the user's files, in a tooltip. */
  description: string;
}

const WORKSPACE_KIND_WORDS: Record<WorkspaceKind, WorkspaceKindWords> = {
  standard: { label: 'Standard', description: 'Holds every file of what it is loaded from' },
  partial: { label: 'Partial', description: 'Holds only the files and folders chosen for it' },
  dynamic: { label: 'Dynamic', description: 'Downloads each file the first time it is opened' },
};

/** How a workspace's kind is named wherever it is shown (the workspace's details say it for every kind). */
export function workspaceKindWords(kind: WorkspaceKind): WorkspaceKindWords {
  return WORKSPACE_KIND_WORDS[kind];
}

/**
 * The chip a workspace's row or card shows for its kind: none for a standard workspace, the way most are, nor while
 * its kind is still unread, so only the workspaces that hold their files another way stand out.
 */
export function workspaceKindChip(kind: WorkspaceKind | undefined): WorkspaceKindWords | null {
  return kind === undefined || kind === 'standard' ? null : WORKSPACE_KIND_WORDS[kind];
}

/** The collapsed sidebar's tooltip of the workspace card: its name and repository, and its kind when not standard. */
export function workspaceCardTip(workspace: { name: string; repository: string; kind?: WorkspaceKind }): string {
  const chip = workspaceKindChip(workspace.kind);
  return [workspace.name, workspace.repository, chip && `${chip.label} workspace`].filter(Boolean).join(' · ');
}
