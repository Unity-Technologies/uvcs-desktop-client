import { usePlace } from '../../app/workspace/useWorkspace';
import { RepositoryFilesView } from '../repositoryFiles/RepositoryFilesView';
import { FilesView } from './FilesView';

/** Files: a workspace's on disk (`FilesView`), or a branch's latest tree in a repository explored without one (`RepositoryFilesView`). */
export function PlaceFilesView() {
  const place = usePlace();
  return place.kind === 'workspace' ? <FilesView /> : <RepositoryFilesView place={place} />;
}
