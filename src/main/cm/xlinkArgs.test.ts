import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NewXlink } from '@shared/domain/xlinks';
import { createXlinkArgs, repositoryFolder, xlinkPointSpec, xlinkRuleArg } from './xlinkArgs';

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
