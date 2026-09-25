import type { MergeKind } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import { navigation } from '../../app/navigation/navigationStore';
import { switchWorkspace } from '../../app/shell/workspaceOperations';
import { toast } from '../../ui/toast/toastStore';

/** Operations started from the Branch Explorer; each one delegates to the view or flow that owns it. */
export const graphActions = {
  switchToChangeset: (workspacePath: string, id: number) => void switchWorkspace(workspacePath, spec.changeset(id), `changeset ${id}`),
  switchToBranch: (workspacePath: string, name: string) => void switchWorkspace(workspacePath, spec.branch(name), name),
  switchToLabel: (workspacePath: string, name: string) => void switchWorkspace(workspacePath, spec.label(name), `label ${name}`),

  merge: (kind: MergeKind, sourceSpec: string) => navigation.openPage({ kind: 'merge', request: { kind, sourceSpec } }),

  diffChangeset: (id: number) =>
    navigation.openPage({ kind: 'diff', title: `Changeset ${id}`, target: { kind: 'changeset', changesetId: id } }),
  diffBranch: (name: string) => navigation.openPage({ kind: 'diff', title: `Branch ${name}`, target: { kind: 'branch', branch: name } }),

  copy: (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.info(`Copied ${text}`);
  },
};
