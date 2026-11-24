import { isFavoriteOrganization } from '@shared/domain/favoriteOrganizations';
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

/** The kinds a user can mark as a favorite: the organizations, of which some people have dozens. */
const ORGANIZATION_KINDS: readonly ServerKind[] = ['unityOrganization', 'cloudOrganization'];

/**
 * From how many organizations the sidebar offers its filter (`showsOrganizationFilter`). Most people have one to three
 * and never see it; past about ten names, people stop scanning a list and start reading it, which is when typing a few
 * letters is faster.
 */
export const ORGANIZATION_FILTER_MIN = 10;

interface ServerGroupOptions {
  /** The servers of the organizations marked as favorites (`AppSettings.favoriteOrganizations`). */
  favorites?: readonly string[];
  /** Text the names must hold, whatever its case: the sidebar's filter. */
  filter?: string;
}

/**
 * The servers the sidebar lists, grouped: the favorite organizations, then the other Unity organizations, the cloud
 * organizations from before them, then this computer and on-premises servers. Each by name, this computer first among
 * the servers; a group with none is left out. A favorite shows only under Favorites. With a filter, only the
 * organizations whose name holds it; this computer and the servers, few, always show.
 */
export function serverGroups(servers: readonly ServerProfile[], { favorites = [], filter = '' }: ServerGroupOptions = {}): ServerGroup[] {
  const shown = servers.filter((profile) => matchesFilter(profile.server, filter)).sort(byPlace);
  const isFavorite = (profile: ServerProfile): boolean => isFavoriteOrganization(favorites, profile.server) && canBeFavorite(profile.server);
  const groups = [
    { label: 'Favorites', servers: shown.filter(isFavorite) },
    ...GROUPS.map(({ label, kinds }) => ({ label, servers: shown.filter((profile) => !isFavorite(profile) && kinds.includes(serverKind(profile.server))) })),
  ];
  return groups.filter((group) => group.servers.length > 0);
}

/** Whether the server is an organization, which the user can mark as a favorite. */
export function canBeFavorite(server: string): boolean {
  return ORGANIZATION_KINDS.includes(serverKind(server));
}

/** Whether the sidebar offers its filter: only to someone with many organizations (`ORGANIZATION_FILTER_MIN`). */
export function showsOrganizationFilter(servers: readonly ServerProfile[]): boolean {
  return servers.filter((profile) => canBeFavorite(profile.server)).length >= ORGANIZATION_FILTER_MIN;
}

/** What the star and the menu entry that add an organization to the favorites, or take it out, are called. */
export function favoriteButtonLabel(name: string, favorite: boolean): string {
  return favorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`;
}

function matchesFilter(server: string, filter: string): boolean {
  if (!canBeFavorite(server)) return true;
  const text = filter.trim().toLocaleLowerCase();
  return describeServer(server).label.toLocaleLowerCase().includes(text);
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
