import type { HeaderReaders } from './WorkspaceHeaders';

/**
 * The readers of `WorkspaceHeaders`, telling (`changed`) when a workspace's header names another repository than its
 * last read did: a switch to another repository, made here or anywhere else, or a rename. What was kept by the
 * workspace's place for the repository it was on (`BranchNamesCache`'s names by id, which are per repository) goes then.
 */
export function tellingRepositoryChanges(readers: HeaderReaders, changed: (workspacePath: string) => void): HeaderReaders {
  const lastRepository = new Map<string, string>();
  return {
    ...readers,
    status: async (workspacePath) => {
      const status = await readers.status(workspacePath);
      const repository = `${status.repositoryName}@${status.server}`;
      const before = lastRepository.get(workspacePath);
      lastRepository.set(workspacePath, repository);
      if (before !== undefined && before !== repository) changed(workspacePath);
      return status;
    },
  };
}
