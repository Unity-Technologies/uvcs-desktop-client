import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { keyboardMergeSource } from './graphKeyboard';

describe('keyboardMergeSource', () => {
  it('merges the changeset or branch selected into the workspace', () => {
    expect(keyboardMergeSource({ kind: 'changeset', id: 7 }, true)).toBe('cs:7');
    expect(keyboardMergeSource({ kind: 'branch', name: '/main/task' }, true)).toBe('br:/main/task');
    expect(keyboardMergeSource({ kind: 'pending' }, true)).toBeNull();
    expect(keyboardMergeSource(null, true)).toBeNull();
  });

  it('merges nothing in a repository explored without a workspace: there is none to merge into', () => {
    expect(keyboardMergeSource({ kind: 'changeset', id: 7 }, false)).toBeNull();
    expect(keyboardMergeSource({ kind: 'branch', name: '/main/task' }, false)).toBeNull();
  });
});
