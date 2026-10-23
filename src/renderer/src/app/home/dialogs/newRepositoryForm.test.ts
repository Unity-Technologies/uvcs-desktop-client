import { describe, expect, it } from 'vitest';
import { formProject, newRepositoryOf } from './newRepositoryForm';

const PROJECTS = ['Archived', 'Racing'];

describe('newRepositoryOf', () => {
  it("names the repository after the project picked, as cm creates it in a Unity organization", () => {
    expect(newRepositoryOf({ name: ' Game ', project: 'Racing', projects: PROJECTS, takenNames: [] })).toEqual({
      asksProject: true,
      fullName: 'Racing/Game',
      needsProject: false,
      nameTaken: false,
    });
  });

  it('needs a project picked in a Unity organization', () => {
    expect(newRepositoryOf({ name: 'Game', project: null, projects: PROJECTS, takenNames: [] })).toMatchObject({ asksProject: true, needsProject: true });
  });

  it('tells a name taken in the project picked, not one another project holds', () => {
    const takenNames = ['Racing/Game'];

    expect(newRepositoryOf({ name: 'Game', project: 'Racing', projects: PROJECTS, takenNames }).nameTaken).toBe(true);
    expect(newRepositoryOf({ name: 'Game', project: 'Archived', projects: PROJECTS, takenNames }).nameTaken).toBe(false);
  });

  it('creates the name as typed on a server without projects, whatever was picked before', () => {
    expect(newRepositoryOf({ name: 'tools', project: 'Racing', projects: [], takenNames: ['game'] })).toEqual({
      asksProject: false,
      fullName: 'tools',
      needsProject: false,
      nameTaken: false,
    });
  });
});

describe('formProject', () => {
  it('starts on the project the list shows', () => {
    expect(formProject(undefined, 'Racing', PROJECTS)).toBe('Racing');
  });

  it('starts on none for all projects, or a project the server no longer has', () => {
    expect(formProject(undefined, null, PROJECTS)).toBeNull();
    expect(formProject(undefined, 'Deleted', PROJECTS)).toBeNull();
  });

  it('takes the project picked over the one the list shows', () => {
    expect(formProject('Archived', 'Racing', PROJECTS)).toBe('Archived');
  });
});
