import { describe, expect, it } from 'vitest';
import { toolSubject } from './toolSubjects';

describe('toolSubject', () => {
  it("keeps a changed file's own repository, which under an xlink isn't the window's", () => {
    const revision = { kind: 'revision', revision: { revisionId: 40, repository: 'art@srv' }, fileName: 'a.png' } as const;
    expect(toolSubject.version(revision, 'a.png')).toEqual({ kind: 'revision', version: revision, fileName: 'a.png', repository: 'art@srv' });
    const atChangeset = { kind: 'repositoryPath', path: '/a.png', at: 'cs:5', repository: 'art@srv' } as const;
    expect(toolSubject.version(atChangeset, 'a.png')).toMatchObject({ repository: 'art@srv' });
  });

  it("names no repository where the version doesn't, so the window's fills it in", () => {
    expect(toolSubject.version({ kind: 'spec', spec: 'serverpath:/a.png#cs:5' }, 'a.png')).not.toHaveProperty('repository');
    expect(toolSubject.version({ kind: 'repositoryPath', path: '/a.png', at: 'cs:5' }, 'a.png')).not.toHaveProperty('repository');
  });

  it("takes a changeset's own repository, else the one its list names", () => {
    expect(toolSubject.changeset({ id: 5, branch: '/main' }, 'game@local')).toEqual({ kind: 'changeset', id: 5, branch: '/main', repository: 'game@local' });
    expect(toolSubject.changeset({ id: 5, branch: '/main', repository: 'art@srv' }, 'game@local')).toMatchObject({ repository: 'art@srv' });
  });
});
