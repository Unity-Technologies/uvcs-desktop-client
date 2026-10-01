import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSelectorFile, readWorkspaceHeads } from './selectorFile';

describe('parseSelectorFile', () => {
  it('reads the repository and smart branch', () => {
    expect(parseSelectorFile('rep "acme@acme@cloud"\n  path "/"\n    smartbranch "/main/scm1/scm1d"')).toEqual({
      repository: 'acme@acme@cloud',
      selector: { kind: 'branch', name: '/main/scm1/scm1d' },
    });
  });

  it('reads a plain branch with its checkout branch', () => {
    expect(parseSelectorFile('repository "game@local"\r\n  path "/"\r\n    br "/main"\r\n    co "/main"\r\n')).toEqual({
      repository: 'game@local',
      selector: { kind: 'branch', name: '/main' },
    });
  });

  it('keeps the branch of a smart branch pinned to a changeset', () => {
    expect(parseSelectorFile('repository "game@local"\n  path "/"\n    smartbranch "/main/task" changeset "15"')?.selector).toEqual({
      kind: 'branch',
      name: '/main/task',
    });
  });

  it('reads a shelve', () => {
    // `.plastic/plastic.selector` of a workspace switched to shelve 2 (cm 11.0.16.10371).
    expect(parseSelectorFile('repository "uvcs-shelvews-sandbox@local"\n  path "/"\n    shelve "2"\n')).toEqual({
      repository: 'uvcs-shelvews-sandbox@local',
      selector: { kind: 'shelve', name: '2' },
    });
  });

  it('reads labels and changesets', () => {
    expect(parseSelectorFile('repository "a@b"\n path "/"\n  label "BL100"')?.selector).toEqual({ kind: 'label', name: 'BL100' });
    expect(parseSelectorFile('repository "a@b"\n path "/"\n  changeset "42"')?.selector).toEqual({ kind: 'changeset', name: '42' });
  });

  it('keeps repository names with spaces and folders', () => {
    expect(parseSelectorFile('rep "Cloud Repositories/Sample@acme@cloud"\n path "/"')).toEqual({
      repository: 'Cloud Repositories/Sample@acme@cloud',
      selector: null,
    });
  });

  it('rejects a repository without its server', () => {
    expect(parseSelectorFile('repository "game"\n path "/"\n br "/main"')).toBeNull();
    expect(parseSelectorFile('')).toBeNull();
  });
});

describe('readWorkspaceHeads', () => {
  it("reads each workspace's selector file, leaving out those it can't read or understand", async () => {
    const root = await mkdtemp(join(tmpdir(), 'uvcs-heads-'));
    const workspace = async (name: string, selector?: string): Promise<string> => {
      const path = join(root, name);
      await mkdir(join(path, '.plastic'), { recursive: true });
      if (selector !== undefined) await writeFile(join(path, '.plastic', 'plastic.selector'), selector);
      return path;
    };
    const game = await workspace('game', 'repository "game@local"\n  path "/"\n    br "/main/task"\n');
    const unreadable = await workspace('no-selector');
    const garbled = await workspace('garbled', 'not a selector');

    expect(await readWorkspaceHeads([game, unreadable, garbled, join(root, 'gone')])).toEqual({
      [game]: { repository: 'game@local', selector: { kind: 'branch', name: '/main/task' } },
    });
  });
});
