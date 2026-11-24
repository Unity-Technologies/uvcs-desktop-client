import { describe, expect, it } from 'vitest';
import { otherRepository, repositoryKey } from './repository';

describe('otherRepository', () => {
  it("names the xlinked repository an item lives in, not the workspace's own", () => {
    expect(otherRepository('editorGUI@acme@cloud', 'acme@acme@cloud')).toBe('editorGUI@acme@cloud');
    expect(otherRepository('acme@acme@cloud', 'acme@acme@cloud')).toBeUndefined();
  });

  it("tells nothing for a private item or while the workspace's repository is unknown", () => {
    expect(otherRepository('', 'acme@acme@cloud')).toBeUndefined();
    expect(otherRepository('editorGUI@acme@cloud', undefined)).toBeUndefined();
  });
});

describe('repositoryKey', () => {
  it('is the same however a workspace of the repository writes it: its name and its server in any case', () => {
    expect(repositoryKey('Game@ACME@unity')).toBe(repositoryKey('game@acme@unity'));
    expect(repositoryKey('game@Local')).toBe(repositoryKey('game@local'));
  });

  it('is the same for a server written with or without its protocol', () => {
    expect(repositoryKey('game@ssl://host:8088')).toBe(repositoryKey('game@host:8088'));
  });

  it('tells repositories of one name apart by their server: another organization, a cloud one of the same name, a local server', () => {
    const keys = ['game@acme@unity', 'game@other@unity', 'game@acme@cloud', 'game@local', 'game@host:8087', 'game-art@acme@unity'].map(repositoryKey);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps a repository nested in a folder whole', () => {
    expect(repositoryKey('art/Textures@local')).toBe('art/textures@local');
  });
});
