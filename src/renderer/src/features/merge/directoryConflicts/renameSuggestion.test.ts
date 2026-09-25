import { describe, expect, it } from 'vitest';
import { suggestRename } from './renameSuggestion';

describe('suggestRename', () => {
  it('adds the destination branch name before the extension', () => {
    expect(suggestRename('/src/twin.txt', '/main')).toBe('twin-main.txt');
    expect(suggestRename('/Makefile', '/main/task 1')).toBe('Makefile-task-1');
    expect(suggestRename('/.gitignore', '/main')).toBe('.gitignore-main');
  });
});
