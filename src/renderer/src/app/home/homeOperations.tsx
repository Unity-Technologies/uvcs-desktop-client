import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { confirm } from '../../ui/dialog/confirm';
import { askDialog } from '../../ui/dialog/dialogStore';
import { prompt } from '../../ui/dialog/prompt';
import { toast } from '../../ui/toast/toastStore';
import { queryClient } from '../queryClient';
import { forgetRecentWorkspace } from '../settings/useSettings';
import { DeleteRepositoryDialog } from './dialogs/DeleteRepositoryDialog';

async function runAndRefresh(failureTitle: string, action: () => Promise<unknown>, queryKey: readonly unknown[]): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    toast.error(failureTitle, error);
    return false;
  } finally {
    void queryClient.invalidateQueries({ queryKey });
  }
}

export async function renameWorkspace(workspace: WorkspaceSummary): Promise<void> {
  const newName = await prompt({ title: 'Rename workspace', label: 'Name', initialValue: workspace.name, confirmLabel: 'Rename' });
  if (!newName) return;
  await runAndRefresh("Couldn't rename the workspace", () => api.workspaces.rename(workspace.path, newName), queryKeys.workspaces);
}

export async function removeWorkspace(workspace: WorkspaceSummary): Promise<void> {
  const confirmed = await confirm({
    title: `Remove ${workspace.name}?`,
    message: `The workspace stops being tracked. Your files in ${workspace.path} stay on disk.`,
    confirmLabel: 'Remove workspace',
    danger: true,
  });
  if (!confirmed) return;

  const removed = await runAndRefresh("Couldn't remove the workspace", () => api.workspaces.remove(workspace.path), queryKeys.workspaces);
  if (removed) await forgetRecentWorkspace(workspace.path);
}

export function revealWorkspace(workspace: WorkspaceSummary): void {
  void api.system.revealInFileManager(workspace.path);
}

export async function renameRepository(repository: RepositorySummary): Promise<void> {
  const newName = await prompt({ title: 'Rename repository', label: 'Name', initialValue: repository.name, confirmLabel: 'Rename' });
  if (!newName) return;
  await runAndRefresh(
    "Couldn't rename the repository",
    () => api.repositories.rename(repository.spec, newName),
    queryKeys.repositories(repository.server),
  );
}

export async function deleteRepository(repository: RepositorySummary): Promise<void> {
  const confirmed = await askDialog<true>((finish) => <DeleteRepositoryDialog repository={repository} finish={finish} />);
  if (!confirmed) return;

  const deleted = await runAndRefresh(
    "Couldn't delete the repository",
    () => api.repositories.remove(repository.spec),
    queryKeys.repositories(repository.server),
  );
  if (deleted) toast.success(`Deleted ${repository.name}`);
}

export function copyRepositorySpec(repository: RepositorySummary): void {
  void navigator.clipboard.writeText(repository.spec);
  toast.info('Repository spec copied', repository.spec);
}
