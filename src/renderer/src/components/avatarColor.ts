import { avatarColorOf, type AvatarColor } from '../lib/avatarColors';
import { lastSegment } from '../lib/paths';
import { splitRepositorySpec } from '../lib/servers';

/**
 * The fill of a workspace's or a repository's avatar: its repository's (by its short name, without server or
 * organization), so workspaces of one repository look alike wherever they show; the workspace's own name while its
 * repository isn't known.
 */
export function avatarColor(repository: string | null | undefined, workspaceName: string): AvatarColor {
  const name = repository ? splitRepositorySpec(repository).name : workspaceName;
  return avatarColorOf(lastSegment(name) || name);
}
