import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NewXlink } from '@shared/domain/xlinks';
import { repositoryFolder } from '@shared/domain/xlinks';
import { createXlinkArgs, loadXlinkArgs, labelChangesetArgs, repositoryFolderArgs, xlinkPointSpec, xlinkRuleArg, xlinkTreeSpec } from './xlinkArgs';
import { TREE_ITEM_FORMAT } from './treeItems';

const LIB = join('wk', 'code', 'lib');

const xlink = (changes: Partial<NewXlink> = {}): NewXlink => ({
  path: 'code/lib',
  repository: 'lib@acme@cloud',
  point: { kind: 'changeset', changeset: 17 },
  writable: false,
  relativeServer: false,
  folder: '/',
  rules: [],
  ...changes,
});

describe('Where an xlink points, as cm xlink takes it', () => {
  it('names a changeset, a branch or a label in the xlinked repository, a cloud one too', () => {
    expect(xlinkPointSpec({ kind: 'changeset', changeset: 17 }, 'lib@acme@cloud')).toBe('cs:17@lib@acme@cloud');
    expect(xlinkPointSpec({ kind: 'branch', branch: '/main/dev' }, 'lib@local')).toBe('br:/main/dev@lib@local');
    expect(xlinkPointSpec({ kind: 'label', label: ' v1.2 ' }, 'lib@local')).toBe('lb:v1.2@lib@local');
  });

  it('takes a branch typed without its leading slash', () => {
    expect(xlinkPointSpec({ kind: 'branch', branch: 'main/task 1' }, 'lib@local')).toBe('br:/main/task 1@lib@local');
  });
});

describe('Branch expansion rules, as cm xlink takes them', () => {
  it('joins the two branches as cm splits them, at -br:/, hyphens in names kept', () => {
    expect(xlinkRuleArg({ from: '/main/my-fix', to: 'main/fix-1' })).toBe('br:/main/my-fix-br:/main/fix-1');
  });
});

describe('Creating an xlink', () => {
  it('creates a read-only xlink of the whole repository by default', () => {
    expect(createXlinkArgs(LIB, xlink())).toEqual(['xlink', LIB, '/', 'cs:17@lib@acme@cloud']);
  });

  it('creates a writable one with its rules, relative to the workspace’s server when asked', () => {
    const writable = xlink({ writable: true, relativeServer: true, rules: [{ from: '/main', to: '/main/dev' }] });

    expect(createXlinkArgs(LIB, writable)).toEqual(['xlink', '-w', '-rs', LIB, '/', 'cs:17@lib@acme@cloud', 'br:/main-br:/main/dev']);
  });

  it('shows a folder of the repository only in a read-only xlink: cm refuses it for a writable one', () => {
    expect(createXlinkArgs(LIB, xlink({ folder: 'Assets/Lib/' }))).toContain('/Assets/Lib');
    expect(createXlinkArgs(LIB, xlink({ writable: true, folder: '/Assets/Lib' }))).toEqual(['xlink', '-w', LIB, '/', 'cs:17@lib@acme@cloud']);
  });

  it('leaves out rules a read-only xlink has no use for', () => {
    expect(createXlinkArgs(LIB, xlink({ rules: [{ from: '/main', to: '/main/dev' }] }))).toEqual(['xlink', LIB, '/', 'cs:17@lib@acme@cloud']);
  });
});

describe('A folder of the xlinked repository', () => {
  it('is rooted at /, whichever separators it was typed with', () => {
    expect(repositoryFolder('')).toBe('/');
    expect(repositoryFolder(' / ')).toBe('/');
    expect(repositoryFolder('Assets\\Lib\\')).toBe('/Assets/Lib');
  });
});

describe('The tree of the repository an xlink points to', () => {
  it('is listed at a changeset or a branch head as cm ls takes them; a label cm ls refuses is read at its changeset', () => {
    expect(xlinkTreeSpec({ kind: 'changeset', changeset: 4 }, 'lib@local')).toBe('cs:4@lib@local');
    expect(xlinkTreeSpec({ kind: 'branch', branch: 'main' }, 'lib@acme@cloud')).toBe('br:/main@lib@acme@cloud');
    expect(xlinkTreeSpec({ kind: 'label', label: 'v1.0' }, 'lib@local')).toBeNull();
    expect(labelChangesetArgs(' v1.0 ', 'lib@local')[2]).toBe("where name = 'v1.0' on repository 'lib@local'");
  });

  it('lists one folder at a time, rooted at /', () => {
    expect(repositoryFolderArgs('Assets/Lib', 'cs:4@lib@local')).toEqual(['ls', '/Assets/Lib', '--tree=cs:4@lib@local', TREE_ITEM_FORMAT]);
    expect(repositoryFolderArgs('/', 'cs:4@lib@local')[1]).toBe('/');
  });
});

describe('Loading a checked-in xlink’s files', () => {
  const WORKSPACE = join('wkspaces', 'game');

  // Updating the xlink's own folder fails for one showing a folder of its repository ("Can't move  to <folder>").
  it('updates the folder holding the xlink, never its own', () => {
    expect(loadXlinkArgs(WORKSPACE, 'code/lib')).toEqual(['update', join(WORKSPACE, 'code'), '--machinereadable', '--noinput', '--dontmerge']);
  });

  it('updates the workspace’s root, named, for an xlink at the root', () => {
    expect(loadXlinkArgs(WORKSPACE, 'lib')[1]).toBe(join(WORKSPACE));
  });
});
