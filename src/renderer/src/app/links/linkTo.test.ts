import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../testing/fakeWindow';
import { diffTargetObject, linkCopyText, repositoryLinkTo } from './linkTo';

describe('repositoryLinkTo', () => {
  it("writes the link to a repository's object as cm names the repository", () => {
    expect(repositoryLinkTo('game@acme@unity', { object: { kind: 'changeset', id: 12 } })).toBe('uvcs://acme.unity/repos/game/changesets/12');
    expect(repositoryLinkTo('game@ssl://host:8088', {})).toBe('uvcs://host:8088/repos/game');
  });
});

describe('linkCopyText', () => {
  it("names the object's own repository when known, else the workspace's, read when copied", async () => {
    expect(linkCopyText('/ws', 'lib@local', { object: { kind: 'label', name: 'v1' } })).toBe('uvcs://local/repos/lib/labels/v1');
    fakeApi.answer('workspaces.info', async () => ({ repository: 'game@local' }));
    const copy = linkCopyText('/ws', undefined, { object: { kind: 'codeReview', id: 9 } });
    expect(typeof copy === 'function' && (await copy())).toBe('uvcs://local/repos/game/code-reviews/9');
  });
});

describe('diffTargetObject', () => {
  it('names what a diff compares', () => {
    expect(diffTargetObject({ kind: 'changeset', changesetId: 5 })).toEqual({ kind: 'changeset', id: 5 });
    expect(diffTargetObject({ kind: 'branch', branch: '/main/task' })).toEqual({ kind: 'branch', name: '/main/task' });
    expect(diffTargetObject({ kind: 'shelve', shelveId: 3 })).toEqual({ kind: 'shelve', id: 3 });
    expect(diffTargetObject({ kind: 'range', fromSpec: 'cs:4', toSpec: 'cs:9' })).toEqual({ kind: 'changesetRange', from: 4, to: 9 });
    expect(diffTargetObject({ kind: 'range', fromSpec: 'lb:v1', toSpec: 'lb:v2' })).toEqual({ kind: 'labelRange', from: 'v1', to: 'v2' });
  });

  it('names none for a range no link names: two branch heads, mixed points, another repository', () => {
    expect(diffTargetObject({ kind: 'range', fromSpec: 'br:/main', toSpec: 'cs:9' })).toBeNull();
    expect(diffTargetObject({ kind: 'range', fromSpec: 'cs:4', toSpec: 'lb:v2' })).toBeNull();
    expect(diffTargetObject({ kind: 'range', fromSpec: 'cs:4@lib@local', toSpec: 'cs:9@lib@local' })).toBeNull();
  });
});
