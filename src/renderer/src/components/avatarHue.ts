import { lastSegment } from '../lib/paths';
import { splitRepositorySpec } from '../lib/servers';
import { stableHue } from '../lib/stableHue';

/**
 * The color of a workspace's or a repository's avatar: its repository's (by its short name, without server or
 * organization), so workspaces of one repository look alike wherever they show; the workspace's own name while its
 * repository isn't known.
 */
export function avatarHue(repository: string | null | undefined, workspaceName: string): number {
  const name = repository ? splitRepositorySpec(repository).name : workspaceName;
  return stableHue(lastSegment(name) || name);
}
