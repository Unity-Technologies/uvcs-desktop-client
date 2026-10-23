import { nameWithProject } from '@shared/domain/organizations';
import { isRepositoryNameTaken } from '../workspaceNaming';

interface NewRepositoryForm {
  /** As typed. */
  name: string;
  /** The project picked; none yet, or on a server without projects. */
  project: string | null;
  /** The server's projects: a Unity organization's, none elsewhere. */
  projects: readonly string[];
  /** The names of the server's repositories, projects included (`Racing/Game`). */
  takenNames: readonly string[];
}

/**
 * What the New repository dialog creates: in a Unity organization, the repository named after the project picked
 * (`Racing/Game`), which it can't create until one is; elsewhere, the name as typed.
 */
export function newRepositoryOf({ name, project, projects, takenNames }: NewRepositoryForm) {
  const trimmed = name.trim();
  const asksProject = projects.length > 0;
  const fullName = nameWithProject(trimmed, asksProject ? project : null);
  return {
    asksProject,
    fullName,
    needsProject: asksProject && project === null,
    nameTaken: trimmed !== '' && isRepositoryNameTaken(fullName, takenNames),
  };
}

/**
 * The project the dialog creates in: the one picked (none picked yet is `undefined`; a server changed starts over),
 * else the one the list shows when the server has it, else none, for the user to pick.
 */
export function formProject(picked: string | null | undefined, shown: string | null | undefined, projects: readonly string[]): string | null {
  if (picked !== undefined) return picked;
  return shown && projects.includes(shown) ? shown : null;
}
