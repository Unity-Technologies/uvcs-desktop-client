import { formatLink } from '@shared/links/formatLink';
import type { HomeSection } from './homeSection';

/**
 * The link to what the home screen shows, as ⇧⌘C copies it: a server's repositories, the Unity project picked when
 * there is one (`uvcs://acme.unity/projects/Racing`). The welcome and every workspace are this computer's alone: none.
 */
export function homeLink(section: HomeSection, project: string | null): string | null {
  if (section.kind !== 'server') return null;
  return formatLink(project ? { kind: 'server', server: section.server, project } : { kind: 'server', server: section.server });
}
