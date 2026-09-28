import { lastSegment } from '../lib/paths';
import { splitRepositorySpec } from '../lib/servers';
import { stableHueIndex } from '../lib/stableHue';

/** The avatar fills of `styles/tokens.css`, one per `STABLE_HUES` hue and in their order, so a name keeps its color family. */
export const AVATAR_COLORS = [
  '--avatar-blue',
  '--avatar-cyan',
  '--avatar-teal',
  '--avatar-green',
  '--avatar-lime',
  '--avatar-amber',
  '--avatar-orange',
  '--avatar-red',
  '--avatar-rose',
  '--avatar-pink',
] as const;

/**
 * The fill of a workspace's or a repository's avatar: its repository's (by its short name, without server or
 * organization), so workspaces of one repository look alike wherever they show; the workspace's own name while its
 * repository isn't known.
 */
export function avatarColor(repository: string | null | undefined, workspaceName: string): (typeof AVATAR_COLORS)[number] {
  const name = repository ? splitRepositorySpec(repository).name : workspaceName;
  return AVATAR_COLORS[stableHueIndex(lastSegment(name) || name)]!;
}
