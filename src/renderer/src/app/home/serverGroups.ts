import { serverKind, type ServerKind } from '@shared/domain/organizations';
import type { ServerProfile } from '@shared/domain/repository';
import { describeServer } from '../../lib/servers';

/** A group of the home sidebar's places to browse: one kind of server, by name. */
export interface ServerGroup {
  label: string;
  servers: ServerProfile[];
}

const GROUPS: { label: string; kinds: readonly ServerKind[] }[] = [
  { label: 'Unity organizations', kinds: ['unityOrganization'] },
  { label: 'Cloud organizations', kinds: ['cloudOrganization'] },
  { label: 'Servers', kinds: ['local', 'server'] },
];

/**
 * The servers the sidebar lists, grouped by kind: Unity organizations, then the cloud organizations from before them,
 * then this computer and on-premises servers. Each by name, this computer first among the servers; a group with none
 * is left out.
 */
export function serverGroups(servers: readonly ServerProfile[]): ServerGroup[] {
  return GROUPS.map(({ label, kinds }) => ({ label, servers: servers.filter((profile) => kinds.includes(serverKind(profile.server))).sort(byPlace) })).filter(
    (group) => group.servers.length > 0,
  );
}

/**
 * The quiet text after a server's entry: a server's user, as a server is an account of its own, listed under every
 * Unity account. An organization's needs none, as the switcher names its account and its group its kind; folded, where
 * groups are only rules and the text goes to the tooltip (`navItemTip`), the kind: `acme · Unity organization`.
 */
export function serverEntryDetail({ server, user }: ServerProfile, rail: boolean): string | undefined {
  const kind = serverKind(server);
  if (kind === 'server') return user || undefined;
  return rail ? describeServer(server).detail : undefined;
}

function byPlace(a: ServerProfile, b: ServerProfile): number {
  if (a.server === 'local' || b.server === 'local') return Number(b.server === 'local') - Number(a.server === 'local');
  return describeServer(a.server).label.localeCompare(describeServer(b.server).label, undefined, { sensitivity: 'base' });
}
