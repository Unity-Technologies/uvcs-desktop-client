import type { Place } from '@shared/domain/place';
import { RepositoryScreen } from '../shell/RepositoryScreen';
import { WorkspaceGate } from './WorkspaceGate';

/** The screen of the window's place: a workspace's, once it can be opened (`WorkspaceGate`), or a repository's explored without one. */
export function PlaceScreen({ place }: { place: Place }) {
  return place.kind === 'workspace' ? <WorkspaceGate /> : <RepositoryScreen repository={place.repository} />;
}
