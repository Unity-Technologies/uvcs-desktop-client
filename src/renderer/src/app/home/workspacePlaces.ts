import { isUnityOrganization, serverKind, type ServerKind } from '@shared/domain/organizations';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { describeServer, splitRepositorySpec } from '../../lib/servers';
import type { WorkspaceEntry } from './recentWorkspaces';

/** Where a workspace's repository lives: a server, and in a Unity organization the project too. */
export interface WorkspacePlace {
  server: string;
  project?: string;
}

/** A place to pick in All workspaces, with how many workspaces it holds. */
export interface PlaceChoice {
  place: WorkspacePlace;
  /** Its name: the server's as the sidebar names it, or the project's. */
  label: string;
  /** The organization a project is in, as the sidebar names it. */
  detail?: string;
  workspaceCount: number;
}

/**
 * The place of a workspace, from the repository spec it is known to work on (`Racing/Game@acme@unity`): no command.
 * A Unity organization's repository is named after its project, the part before its first `/`; undefined while the
 * repository isn't known.
 */
export function placeOf(entry: Pick<WorkspaceEntry, 'repository'>): WorkspacePlace | undefined {
  if (!entry.repository) return undefined;
  const { name, server } = splitRepositorySpec(entry.repository);
  const slash = name.indexOf('/');
  return isUnityOrganization(server) && slash > 0 ? { server, project: name.slice(0, slash) } : { server };
}

const KIND_ORDER: readonly ServerKind[] = ['unityOrganization', 'cloudOrganization', 'local', 'server'];

/**
 * Every place the workspaces are on, as the sidebar orders servers (Unity organizations, cloud organizations, this
 * computer, servers), each Unity organization followed by its projects, by name, each with its workspaces counted.
 */
export function placeChoices(entries: readonly Pick<WorkspaceEntry, 'repository'>[]): PlaceChoice[] {
  const servers = new Map<string, { count: number; projects: Map<string, number> }>();
  for (const entry of entries) {
    const place = placeOf(entry);
    if (!place) continue;
    const server = servers.get(place.server) ?? { count: 0, projects: new Map<string, number>() };
    server.count++;
    if (place.project) server.projects.set(place.project, (server.projects.get(place.project) ?? 0) + 1);
    servers.set(place.server, server);
  }
  return [...servers.entries()].sort(([a], [b]) => byServer(a, b)).flatMap(([server, { count, projects }]) => {
    const organization = describeServer(server).label;
    return [
      { place: { server }, label: organization, workspaceCount: count },
      ...[...projects.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([project, workspaceCount]) => ({ place: { server, project }, label: project, detail: organization, workspaceCount })),
    ];
  });
}

function byServer(a: string, b: string): number {
  const byKind = KIND_ORDER.indexOf(serverKind(a)) - KIND_ORDER.indexOf(serverKind(b));
  return byKind || describeServer(a).label.localeCompare(describeServer(b).label, undefined, { sensitivity: 'base' });
}

/**
 * The places whose name, or organization's, holds every word of `search`, each matching project under its
 * organization's row, so two organizations' projects of the same name still read apart.
 */
export function matchingPlaces(choices: readonly PlaceChoice[], search: string): PlaceChoice[] {
  const matching = new Set(choices.filter((choice) => matchesWordFilter([choice.label, choice.detail ?? ''], search)));
  const holdingMatches = new Set([...matching].flatMap((choice) => (choice.place.project === undefined ? [] : [choice.place.server])));
  return choices.filter((choice) => matching.has(choice) || (choice.place.project === undefined && holdingMatches.has(choice.place.server)));
}

/** Whether a workspace is in `place`: on its server, and in its project when it names one. All for none. */
export function isInPlace(entry: Pick<WorkspaceEntry, 'repository'>, place: WorkspacePlace | null): boolean {
  if (place === null) return true;
  const own = placeOf(entry);
  return own !== undefined && own.server === place.server && (place.project === undefined || own.project === place.project);
}

export function samePlace(a: WorkspacePlace | null, b: WorkspacePlace | null): boolean {
  return a?.server === b?.server && a?.project === b?.project;
}

/** A place's key in a list, unique across servers and their projects. */
export function placeKey(place: WorkspacePlace): string {
  return place.project === undefined ? place.server : `${place.server}/${place.project}`;
}

/** How the filter's chip names the place picked: "Everywhere", an organization, or a project in one. */
export function placeLabel(place: WorkspacePlace | null): string {
  if (place === null) return 'Everywhere';
  const organization = describeServer(place.server).label;
  return place.project ? `${place.project} · ${organization}` : organization;
}
