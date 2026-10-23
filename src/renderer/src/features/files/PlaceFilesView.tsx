import { usePlace } from '../../app/workspace/useWorkspace';
import { RepositoryFilesView } from '../repositoryFiles/RepositoryFilesView';
import { FilesView } from './FilesView';

/** Files: a workspace's on disk (`FilesView`), or a branch's latest tree in a repository explored without one (`RepositoryFilesView`). */
export function PlaceFilesView() {
  return usePlace().kind === 'workspace' ? <FilesView /> : <RepositoryFilesView />;
}
