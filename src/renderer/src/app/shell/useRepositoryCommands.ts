import { FolderPlus } from 'lucide-react';
import { useMemo } from 'react';
import { useCommands, type Command } from '../commands/commandStore';
import { createWorkspaceOfExplored } from '../workspace/createWorkspaceOfExplored';

/** Commands only a repository explored without a workspace has, beside every place's (`usePlaceCommands`). */
export function useRepositoryCommands(repository: string): void {
  useCommands(
    useMemo<Command[]>(
      () => [
        {
          id: 'repository.createWorkspace',
          group: 'Workspace',
          label: 'Create workspace…',
          icon: FolderPlus,
          keywords: ['download', 'clone', 'checkout', 'folder'],
          run: () => createWorkspaceOfExplored(repository),
        },
      ],
      [repository],
    ),
  );
}
