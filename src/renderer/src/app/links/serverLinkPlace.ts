import type { ServerProfile } from '@shared/domain/repository';
import type { ServerLink } from '@shared/links/link';
import { sameServer } from '@shared/links/linkSegments';

/**
 * Where a link to a server's repositories leads on the home screen: the server as the user's profiles name it
 * (`ssl://host:8088`, which a link leaves the protocol out of; an organization's name in its case), and the project
 * it names, or all of them: the link opens what it names, not the project picked there last.
 */
export function serverLinkPlace(link: ServerLink, profiles: readonly ServerProfile[]): { server: string; project: string | null } {
  const server = profiles.find((profile) => sameServer(profile.server, link.server))?.server ?? link.server;
  return { server, project: link.project ?? null };
}
