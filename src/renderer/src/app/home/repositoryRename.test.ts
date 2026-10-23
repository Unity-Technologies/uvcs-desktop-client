import { describe, expect, it } from 'vitest';
import type { RepositorySummary } from '@shared/domain/repository';
import { repositoryRename } from './repositoryRename';

const SERVER = 'studio@unity';
const repository = (name: string, project?: string): RepositorySummary => ({ id: name, name, server: SERVER, owner: 'ana', spec: `${name}@${SERVER}`, ...(project ? { project } : {}) });

describe('repositoryRename', () => {
  const GAME = repository('Racing/Game', 'Racing');
  const taken = ['Racing/Game', 'Racing/Art', 'Puzzle/Levels'];

  it("asks for a project's repository by its own name, as its row shows it, and keeps it in its project", () => {
    const rename = repositoryRename(GAME, taken);

    expect(rename.initialName).toBe('Game');
    expect(rename.newName(' Game2 ')).toBe('Racing/Game2');
  });

  it('tells a name taken in the same project, not one another project holds', () => {
    const rename = repositoryRename(GAME, taken);

    expect(rename.isTaken('Art')).toBe(true);
    expect(rename.isTaken('Levels')).toBe(false);
  });

  it('takes its own name back as not taken', () => {
    expect(repositoryRename(GAME, taken).isTaken('Game')).toBe(false);
  });

  it('renames a repository in no project by its whole name', () => {
    const rename = repositoryRename(repository('tools'), ['tools', 'game']);

    expect(rename.initialName).toBe('tools');
    expect(rename.newName('build-tools')).toBe('build-tools');
    expect(rename.isTaken('game')).toBe(true);
  });
});
