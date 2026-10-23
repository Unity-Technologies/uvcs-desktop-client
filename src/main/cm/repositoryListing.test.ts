import { describe, expect, it } from 'vitest';
import { parseRepositoryListing, refusesTypeOption, repositoryListArgs } from './repositoryListing';
import { formatOutput } from './testing/cmOutput';

const ORGANIZATION = 'racing_studio@unity';

describe('repositoryListArgs', () => {
  it("asks a server for its repositories' names, server and owner", () => {
    expect(repositoryListArgs('acme@cloud', { withProjects: false })).toEqual(['repository', 'list', 'acme@cloud', '--format={repid}\u001f{repname}\u001f{repserver}\u001f{repowner}\u001e']);
  });

  it("asks for every type, each one's type and GUID, to list projects in the same command", () => {
    expect(repositoryListArgs(ORGANIZATION, { withProjects: true })).toEqual([
      'repository',
      'list',
      ORGANIZATION,
      '--type=all',
      '--format={repid}\u001f{repname}\u001f{repserver}\u001f{repowner}\u001f{reptype}\u001f{repguid}\u001e',
    ]);
  });
});

const CLOUD_GUID = '7f3e2d1c-0b9a-4876-a543-210fedcba987';
const RACING_GUID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const ARCHIVED_GUID = '9e8d7c6b-5a49-4382-b716-05f4e3d2c1b0';

describe('parseRepositoryListing', () => {
  // As `cm repository list --type=all` prints a Unity organization: projects, repositories in them, and storage.
  const ORGANIZATION_LISTED = formatOutput(
    ['7', 'Cloud Repositories', ORGANIZATION, 'ana', 'Project', CLOUD_GUID],
    ['12', 'Cloud Repositories/TextEditor', ORGANIZATION, 'ana', 'VCS', '5b0c3a52-1d7e-4f0b-9c4f-3e2a8b9d7c61'],
    ['3', 'Racing', ORGANIZATION, 'ana', 'Project', RACING_GUID],
    ['4', 'Racing/Game', ORGANIZATION, 'bob', 'VCS', '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'],
    ['5', 'Archived', ORGANIZATION, 'ana', 'Project', ARCHIVED_GUID],
    ['6', 'storage-01', ORGANIZATION, 'ana', 'WorkspaceStorage', 'c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f'],
  );

  it('reads the projects by name, empty ones too, each with its GUID, apart from the repositories', () => {
    expect(parseRepositoryListing(ORGANIZATION_LISTED, ORGANIZATION, { withProjects: true }).projects).toEqual([
      { name: 'Archived', guid: ARCHIVED_GUID },
      { name: 'Cloud Repositories', guid: CLOUD_GUID },
      { name: 'Racing', guid: RACING_GUID },
    ]);
  });

  it('reads each repository with its project, by name, leaving storage out', () => {
    expect(parseRepositoryListing(ORGANIZATION_LISTED, ORGANIZATION, { withProjects: true }).repositories).toEqual([
      { id: '12', name: 'Cloud Repositories/TextEditor', server: ORGANIZATION, owner: 'ana', spec: `Cloud Repositories/TextEditor@${ORGANIZATION}`, project: 'Cloud Repositories' },
      { id: '4', name: 'Racing/Game', server: ORGANIZATION, owner: 'bob', spec: `Racing/Game@${ORGANIZATION}`, project: 'Racing' },
    ]);
  });

  it('keeps a repository no project names, without one', () => {
    const listed = formatOutput(['3', 'Racing', ORGANIZATION, 'ana', 'Project', RACING_GUID], ['9', 'legacy', ORGANIZATION, 'ana', 'VCS', CLOUD_GUID]);

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
    expect(refusesTypeOption("Requested value 'all' was not found.")).toBe(true);
    expect(refusesTypeOption('Unable to connect to racing_studio@unity')).toBe(false);
  });
});
