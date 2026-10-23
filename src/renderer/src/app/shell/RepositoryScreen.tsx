import { useRepositoryShown } from '../workspace/useRepositoryShown';
import { PlaceLayout } from './PlaceLayout';
import { RepositorySidebarCard } from './RepositorySidebarCard';
import { RepositoryTopBar } from './RepositoryTopBar';
import { StatusBar } from './StatusBar';
import { useRepositoryCommands } from './useRepositoryCommands';
import { useRepositoryWindowTitle } from './useWindowTitle';

/**
 * A repository explored without a workspace (docs/features/explore-repository.md): every place's layout
 * (`PlaceLayout`) on the server's views, with the way to make it a workspace.
 */
export function RepositoryScreen({ repository }: { repository: string }) {
  useRepositoryShown(repository);
  useRepositoryCommands(repository);
  useRepositoryWindowTitle(repository);

  return <PlaceLayout topBar={<RepositoryTopBar repository={repository} />} sidebarCard={<RepositorySidebarCard repository={repository} />} statusBar={<StatusBar />} />;
}
