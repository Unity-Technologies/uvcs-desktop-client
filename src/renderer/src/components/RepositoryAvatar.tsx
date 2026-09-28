import { initialOf } from '../lib/initialOf';
import { TintedMark } from '../ui/TintedMark';
import { avatarHue } from './avatarHue';

interface RepositoryAvatarProps {
  /** `name@server` or a repository's name; while unknown, the color is the label's. */
  repository: string | null | undefined;
  /** Whose initial it shows: a workspace's own name, or the repository's. */
  label: string;
  size: number;
  className?: string;
}

/**
 * An initial on the repository's own color, the same on the home screen, in the switcher and on the sidebar's
 * workspace button, so workspaces of the same repository look alike at a glance.
 */
export function RepositoryAvatar({ repository, label, size, className }: RepositoryAvatarProps) {
  return (
    <TintedMark hue={avatarHue(repository, label)} size={size} className={className}>
      {initialOf(label)}
    </TintedMark>
  );
}
