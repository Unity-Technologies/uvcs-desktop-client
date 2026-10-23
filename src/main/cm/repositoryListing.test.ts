import { describe, expect, it } from 'vitest';
import { parseRepositoryListing, refusesTypeOption, repositoryListArgs } from './repositoryListing';
import { formatOutput } from './testing/cmOutput';

const ORGANIZATION = 'racing_studio@unity';

describe('repositoryListArgs', () => {
  it("asks a server for its repositories' names, server and owner", () => {
    expect(repositoryListArgs('acme@cloud', { withProjects: false })).toEqual(['repository', 'list', 'acme@cloud', '--format={repid}\u001f{repname}\u001f{repserver}\u001f{repowner}\u001e']);
  });

  it("asks for every type and each one's type to list projects in the same command", () => {
    expect(repositoryListArgs(ORGANIZATION, { withProjects: true })).toEqual([
      'repository',
      'list',
      ORGANIZATION,
      '--type=all',
      '--format={repid}\u001f{repname}\u001f{repserver}\u001f{repowner}\u001f{reptype}\u001e',
    ]);
  });
});

describe('parseRepositoryListing', () => {
  // As `cm repository list --type=all` prints a Unity organization: projects, repositories in them, and storage.
  const ORGANIZATION_LISTED = formatOutput(
    ['7', 'Cloud Repositories', ORGANIZATION, 'ana', 'Project'],
    ['12', 'Cloud Repositories/TextEditor', ORGANIZATION, 'ana', 'VCS'],
    ['3', 'Racing', ORGANIZATION, 'ana', 'Project'],
    ['4', 'Racing/Game', ORGANIZATION, 'bob', 'VCS'],
    ['5', 'Archived', ORGANIZATION, 'ana', 'Project'],
    ['6', 'storage-01', ORGANIZATION, 'ana', 'WorkspaceStorage'],
  );

  it('reads the projects by name, empty ones too, apart from the repositories', () => {
    expect(parseRepositoryListing(ORGANIZATION_LISTED, ORGANIZATION, { withProjects: true }).projects).toEqual(['Archived', 'Cloud Repositories', 'Racing']);
  });

  it('reads each repository with its project, by name, leaving storage out', () => {
    expect(parseRepositoryListing(ORGANIZATION_LISTED, ORGANIZATION, { withProjects: true }).repositories).toEqual([
      { id: '12', name: 'Cloud Repositories/TextEditor', server: ORGANIZATION, owner: 'ana', spec: `Cloud Repositories/TextEditor@${ORGANIZATION}`, project: 'Cloud Repositories' },
      { id: '4', name: 'Racing/Game', server: ORGANIZATION, owner: 'bob', spec: `Racing/Game@${ORGANIZATION}`, project: 'Racing' },
    ]);
  });

  it('keeps a repository no project names, without one', () => {
    const listed = formatOutput(['3', 'Racing', ORGANIZATION, 'ana', 'Project'], ['9', 'legacy', ORGANIZATION, 'ana', 'VCS']);

    expect(parseRepositoryListing(listed, ORGANIZATION, { withProjects: true }).repositories).toEqual([
      { id: '9', name: 'legacy', server: ORGANIZATION, owner: 'ana', spec: `legacy@${ORGANIZATION}` },
    ]);
  });

  it('takes a repository whose type a cm without the field printed empty for one of files', () => {
    const listed = formatOutput(['4', 'Racing/Game', ORGANIZATION, 'bob', '']);

    expect(parseRepositoryListing(listed, ORGANIZATION, { withProjects: true })).toEqual({
      repositories: [{ id: '4', name: 'Racing/Game', server: ORGANIZATION, owner: 'bob', spec: `Racing/Game@${ORGANIZATION}` }],
      projects: [],
    });
  });

  it('reads a server listed without types as repositories alone, by name', () => {
    const listed = formatOutput(['4', 'tools', 'acme@cloud', 'bob'], ['2', 'game', 'acme@cloud', 'ana']);

    expect(parseRepositoryListing(listed, 'acme@cloud', { withProjects: false })).toEqual({
      repositories: [
        { id: '2', name: 'game', server: 'acme@cloud', owner: 'ana', spec: 'game@acme@cloud' },
        { id: '4', name: 'tools', server: 'acme@cloud', owner: 'bob', spec: 'tools@acme@cloud' },
      ],
      projects: [],
    });
  });

  it('reads an empty listing as nothing, with CRLF line ends too', () => {
    expect(parseRepositoryListing('', ORGANIZATION, { withProjects: true })).toEqual({ repositories: [], projects: [] });
    expect(parseRepositoryListing(ORGANIZATION_LISTED.replaceAll('\n', '\r\n'), ORGANIZATION, { withProjects: true }).projects).toHaveLength(3);
  });
});

describe('refusesTypeOption', () => {
  it("tells cm's refusal of --type, which names the option, from other failures", () => {
    expect(refusesTypeOption("Unexpected option --type for command 'repository list'")).toBe(true);
    expect(refusesTypeOption('Opción inesperada --type')).toBe(true);
    expect(refusesTypeOption('Unable to connect to racing_studio@unity')).toBe(false);
  });
});
