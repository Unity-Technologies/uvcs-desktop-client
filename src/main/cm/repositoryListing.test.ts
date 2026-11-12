import { describe, expect, it } from 'vitest';
import { refusesTypeOption, repositoryListArgs, repositoryListingOf } from './repositoryListing';
import { formatOutput, recordsIn } from './testing/cmOutput';

const parseRepositoryListing = (output: string, server: string, options: { withProjects: boolean }) => repositoryListingOf(recordsIn(output), server, options);

const ORGANIZATION = 'racing_studio@unity';

describe('repositoryListArgs', () => {
  it("asks a server for its repositories' names, server, owner, type and GUID", () => {
    expect(repositoryListArgs('acme@cloud', { withProjects: false })).toEqual(['repository', 'list', 'acme@cloud', '--format={repid}\u001f{repname}\u001f{repserver}\u001f{repowner}\u001f{reptype}\u001f{repguid}\u001e']);
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
      deletedRepositories: [],
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
      deletedRepositories: [],
    });
  });

  it('reads an empty listing as nothing, with CRLF line ends too', () => {
    expect(parseRepositoryListing('', ORGANIZATION, { withProjects: true })).toEqual({ repositories: [], projects: [], deletedRepositories: [] });
    expect(parseRepositoryListing(ORGANIZATION_LISTED.replaceAll('\n', '\r\n'), ORGANIZATION, { withProjects: true }).projects).toHaveLength(3);
  });
});

describe('deleted repositories', () => {
  const DELETED_GUID = 'd1e2f3a4-b5c6-4d7e-8f90-a1b2c3d4e5f6';
  const OTHER_DELETED_GUID = 'e2f3a4b5-c6d7-4e8f-90a1-b2c3d4e5f6a7';

  it('lists them apart, under the name they had, each named by its GUID', () => {
    const listed = formatOutput(
      ['4', 'tools', 'acme@cloud', 'bob', 'VCS', CLOUD_GUID],
      ['8', '__DELETED__old-tools', 'acme@cloud', 'ana', 'VCS', DELETED_GUID],
      ['9', '__DELETED__art', 'acme@cloud', 'ana', 'VCS', OTHER_DELETED_GUID],
    );

    expect(parseRepositoryListing(listed, 'acme@cloud', { withProjects: false })).toEqual({
      repositories: [{ id: '4', name: 'tools', server: 'acme@cloud', owner: 'bob', spec: 'tools@acme@cloud' }],
      projects: [],
      deletedRepositories: [
        { id: '9', name: 'art', server: 'acme@cloud', owner: 'ana', spec: `${OTHER_DELETED_GUID}@acme@cloud`, deleted: true },
        { id: '8', name: 'old-tools', server: 'acme@cloud', owner: 'ana', spec: `${DELETED_GUID}@acme@cloud`, deleted: true },
      ],
    });
  });

  it('keeps two deleted repositories that had one name, each by its own GUID', () => {
    const listed = formatOutput(['8', '__DELETED__art', 'acme@cloud', 'ana', 'VCS', DELETED_GUID], ['9', '__DELETED__art', 'acme@cloud', 'bob', 'VCS', OTHER_DELETED_GUID]);

    const specs = parseRepositoryListing(listed, 'acme@cloud', { withProjects: false }).deletedRepositories.map((repository) => repository.spec);
    expect(specs.sort()).toEqual([`${DELETED_GUID}@acme@cloud`, `${OTHER_DELETED_GUID}@acme@cloud`].sort());
  });

  it('names one by its listed name when cm printed no GUID', () => {
    const listed = formatOutput(['8', '__DELETED__art', 'acme@cloud', 'ana']);

    expect(parseRepositoryListing(listed, 'acme@cloud', { withProjects: false }).deletedRepositories[0]?.spec).toBe('__DELETED__art@acme@cloud');
  });

  it("gives one its live project, and leaves a deleted project out of the projects", () => {
    const listed = formatOutput(
      ['3', 'Racing', ORGANIZATION, 'ana', 'Project', RACING_GUID],
      ['8', '__DELETED__Racing/Old', ORGANIZATION, 'ana', 'VCS', DELETED_GUID],
      ['5', '__DELETED__Archived', ORGANIZATION, 'ana', 'Project', ARCHIVED_GUID],
    );

    const listing = parseRepositoryListing(listed, ORGANIZATION, { withProjects: true });
    expect(listing.projects).toEqual([{ name: 'Racing', guid: RACING_GUID }]);
    expect(listing.deletedRepositories).toEqual([
      { id: '8', name: 'Racing/Old', server: ORGANIZATION, owner: 'ana', spec: `${DELETED_GUID}@${ORGANIZATION}`, deleted: true, project: 'Racing' },
    ]);
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
