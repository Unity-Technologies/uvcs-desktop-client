// Unity Cloud has two kinds of organizations, told apart by how `cm` names their server: a Unity organization
// (`acme@unity`), whose repositories live in Unity projects, and a cloud organization (`acme@cloud`), from before
// projects existed. A Unity organization's repository is named after its project: `Racing/Game` is the repository
// `Game` of the project `Racing` (docs/ARCHITECTURE.md "Unity organizations").

const UNITY_ORGANIZATION = /^[^@]+@unity$/i;
const CLOUD_ORGANIZATION = /^[^@*]+@cloud$/i;

/** What kind of place a server is, as the home screen groups them. */
export type ServerKind = 'local' | 'unityOrganization' | 'cloudOrganization' | 'server';

/** `local` → this computer, `acme@unity` → a Unity organization, `acme@cloud` → a cloud organization, else a server. */
export function serverKind(server: string): ServerKind {
  if (server === 'local') return 'local';
  if (UNITY_ORGANIZATION.test(server)) return 'unityOrganization';
  if (CLOUD_ORGANIZATION.test(server)) return 'cloudOrganization';
  return 'server';
}

/** Whether the server is a Unity organization (`acme@unity`), whose repositories live in projects. */
export function isUnityOrganization(server: string): boolean {
  return serverKind(server) === 'unityOrganization';
}

/**
 * The project of `projects` a repository named `name` belongs to: the one its name starts with, before a `/`
 * (`Racing/Game` → `Racing`), the longest when several do. Undefined for a name no project starts.
 */
export function projectOfRepository(name: string, projects: ReadonlySet<string>): string | undefined {
  let project: string | undefined;
  for (let slash = name.indexOf('/'); slash > 0; slash = name.indexOf('/', slash + 1)) {
    const prefix = name.slice(0, slash);
    if (projects.has(prefix)) project = prefix;
  }
  return project;
}

/** A repository's name inside its project, as people call it: `Racing/Game` → `Game`; the whole name without one. */
export function nameInProject(name: string, project: string | undefined): string {
  return project ? name.slice(project.length + 1) : name;
}

/** A repository's whole name in a project, as `cm` creates it there: `Game` in `Racing` → `Racing/Game`. */
export function nameWithProject(name: string, project: string | null): string {
  return project ? `${project}/${name}` : name;
}

/** The six colors a Unity project's icon takes, in the order every Unity Version Control client picks them. */
export const PROJECT_COLORS = ['crimson', 'orange', 'amber', 'teal', 'indigo', 'violet'] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number];

/**
 * A project's color, as the other Unity Version Control clients pick it, so a project looks the same in all of them:
 * by the code of its GUID's last character.
 */
export function projectColor(guid: string): ProjectColor {
  return guid ? PROJECT_COLORS[guid.charCodeAt(guid.length - 1) % PROJECT_COLORS.length]! : PROJECT_COLORS[0];
}

/** "All projects" is indigo in every client. */
export const ALL_PROJECTS_COLOR: ProjectColor = 'indigo';
