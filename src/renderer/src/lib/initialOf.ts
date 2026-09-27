import { lastSegment } from './paths';

/**
 * The letter an avatar shows for a name: a workspace's (in the sidebar, the switcher and the home screen alike) or a
 * repository's, whose organization or path prefix (`org/game`) doesn't count.
 */
export function initialOf(name: string): string {
  return (lastSegment(name) || name).charAt(0).toUpperCase();
}
