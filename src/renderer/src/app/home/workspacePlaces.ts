import { isUnityOrganization, projectPartOf, serverKind, type ServerKind } from '@shared/domain/organizations';
import type { UnityProject } from '@shared/domain/repository';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { describeServer, splitRepositorySpec } from '../../lib/servers';
import { entryMatches, type WorkspaceEntry } from './recentWorkspaces';

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
  /** A project's GUID, which colors its icon, once its organization's list was read. */
  guid?: string;
  workspaceCount: number;
}

/**
 * The place of a workspace, from the repository spec it is known to work on (`Racing/Game@acme@unity`): no command.
 * A Unity organization's repository is named after its project (`projectPartOf`); undefined while the repository
 * isn't known.
 */
export function placeOf(entry: Pick<WorkspaceEntry, 'repository'>): WorkspacePlace | undefined {
  if (!entry.repository) return undefined;
  const { name, server } = splitRepositorySpec(entry.repository);
  const project = isUnityOrganization(server) ? projectPartOf(name) : undefined;
  return project === undefined ? { server } : { server, project };
}

const KIND_ORDER: readonly ServerKind[] = ['unityOrganization', 'cloudOrganization', 'local', 'server'];

/**
 * Every place the workspaces are on, as the sidebar orders servers (Unity organizations, cloud organizations, this
 * computer, servers), each Unity organization followed by its projects, by name, each with its workspaces counted and,
 * from the organizations' lists already read (`readProjects`), its GUID.
 */
export function placeChoices(entries: readonly Pick<WorkspaceEntry, 'repository'>[], readProjects: ReadonlyMap<string, readonly UnityProject[]> = new Map()): PlaceChoice[] {
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
    const guids = new Map((readProjects.get(server) ?? []).map((project) => [project.name, project.guid]));
    return [
      { place: { server }, label: organization, workspaceCount: count },
      ...[...projects.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([project, workspaceCount]) => withGuid({ place: { server, project }, label: project, detail: organization, workspaceCount }, guids.get(project))),
    ];
  });
}

function withGuid(choice: PlaceChoice, guid: string | undefined): PlaceChoice {
  return guid === undefined ? choice : { ...choice, guid };
}

/** The Unity organizations the workspaces are on, whose projects' GUIDs their lists, once read, tell. */
export function organizationsOf(entries: readonly Pick<WorkspaceEntry, 'repository'>[]): string[] {
  const organizations = new Set<string>();
  for (const entry of entries) {
    const place = placeOf(entry);
    if (place?.project !== undefined) organizations.add(place.server);
  }
  return [...organizations].sort();
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

/** The workspaces All workspaces shows: those the search finds, in the place picked. */
export function workspacesShown<Entry extends WorkspaceEntry>(entries: readonly Entry[], filter: string, place: WorkspacePlace | null): Entry[] {
  return entries.filter((entry) => entryMatches(entry, filter) && isInPlace(entry, place));
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
