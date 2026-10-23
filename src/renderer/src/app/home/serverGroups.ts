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

function byPlace(a: ServerProfile, b: ServerProfile): number {
  if (a.server === 'local' || b.server === 'local') return Number(b.server === 'local') - Number(a.server === 'local');
  return describeServer(a.server).label.localeCompare(describeServer(b.server).label, undefined, { sensitivity: 'base' });
}
