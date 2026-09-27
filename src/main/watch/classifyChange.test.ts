import { describe, expect, it } from 'vitest';
import { classifyChange, isChangelistFile } from './classifyChange';
import { NO_IGNORE_RULES, parseIgnoreRules } from './ignoreRules';

describe('classifyChange', () => {
  it('reports workspace files as content', () => {
    expect(classifyChange('src/app.ts', NO_IGNORE_RULES)).toBe('content');
  });

  it('reports anything when the platform did not name the item (a Windows watcher whose buffer overflowed)', () => {
    expect(classifyChange(undefined, NO_IGNORE_RULES)).toBe('anything');
  });

  it('reports the workspace state files cm rewrites as metadata, on either separator', () => {
    expect(classifyChange('.plastic/plastic.wktree', NO_IGNORE_RULES)).toBe('metadata');
    expect(classifyChange('.plastic\\plastic.selector', NO_IGNORE_RULES)).toBe('metadata');
    expect(classifyChange('.plastic/changelists/default.xml', NO_IGNORE_RULES)).toBe('metadata');
  });

  it('ignores the locks and temp files every cm command writes', () => {
    for (const noise of ['.plastic', '.plastic/plastic.trees.lck', '.plastic/plastic.lck.operation', '.plastic/fs_beacon', '.plastic/plastic.wktree.old', '.plastic/00d384da-039a-468b-8370-756f6f8ca39d']) {
      expect(classifyChange(noise, NO_IGNORE_RULES)).toBeNull();
    }
  });

  it('ignores changes in ignored folders', () => {
    expect(classifyChange('Library/ArtifactDB', parseIgnoreRules('Library'))).toBeNull();
  });
});

describe('isChangelistFile', () => {
  it('tells the changelist files from the rest of the workspace state, on either separator', () => {
    expect(isChangelistFile('.plastic/changelists/art')).toBe(true);
    expect(isChangelistFile('.plastic\\changelists\\art')).toBe(true);
    expect(isChangelistFile('.plastic/plastic.changes')).toBe(false);
    expect(isChangelistFile('changelists/notes.txt')).toBe(false);
    expect(isChangelistFile(undefined)).toBe(false);
  });
});
