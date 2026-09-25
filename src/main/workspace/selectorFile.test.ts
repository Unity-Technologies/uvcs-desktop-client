import { describe, expect, it } from 'vitest';
import { parseSelectorFile } from './selectorFile';

describe('parseSelectorFile', () => {
  it('reads the repository and smart branch', () => {
    expect(parseSelectorFile('rep "codice@codice@cloud"\n  path "/"\n    smartbranch "/main/scm1/scm1d"')).toEqual({
      repository: 'codice@codice@cloud',
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
