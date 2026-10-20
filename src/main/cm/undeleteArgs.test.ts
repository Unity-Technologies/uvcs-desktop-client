import { describe, expect, it } from 'vitest';
import { undeleteArgs } from './undeleteArgs';

const revision = { revisionId: 18, repository: 'game@local' };

describe('undeleteArgs', () => {
  it('restores the revision the deletion removed at its absolute path in the workspace', () => {
    expect(undeleteArgs('/ws', { revision, path: 'src/Enemy.cs' }, 'darwin')).toEqual(['undelete', 'revid:18', '/ws/src/Enemy.cs']);
  });

  it('names the revision by its bare id: cm undelete refuses any spec that names a repository', () => {
    const [, spec] = undeleteArgs('/ws', { revision: { revisionId: 24, repository: 'AcmeStudio@unity' }, path: 'docs' }, 'linux');
    expect(spec).toBe('revid:24');
  });

  it('writes Windows paths on Windows', () => {
    expect(undeleteArgs('C:\\wkspaces\\game', { revision, path: 'src/Enemy.cs' }, 'win32')).toEqual(['undelete', 'revid:18', 'C:\\wkspaces\\game\\src\\Enemy.cs']);
  });

  it('keeps spaces and accents as they are: one argument, whatever the name', () => {
    expect(undeleteArgs('/ws', { revision, path: 'notes/Café menú.txt' }, 'linux')).toEqual(['undelete', 'revid:18', '/ws/notes/Café menú.txt']);
  });

  it('refuses a path that leads out of the workspace, as the renderer is not trusted', () => {
    expect(() => undeleteArgs('/ws', { revision, path: '../elsewhere/a.cs' }, 'linux')).toThrow('outside the workspace');
    expect(() => undeleteArgs('/ws', { revision, path: '/etc/passwd' }, 'linux')).toThrow('outside the workspace');
    expect(() => undeleteArgs('C:\\ws', { revision, path: 'D:\\a.cs' }, 'win32')).toThrow('outside the workspace');
  });
});
