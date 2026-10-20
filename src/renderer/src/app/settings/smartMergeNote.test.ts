import { describe, expect, it } from 'vitest';
import { smartMergeNote } from './smartMergeNote';

describe('smartMergeNote', () => {
  it('names the Unity Editor Smart Merge comes from, and the tool that opens after it', () => {
    expect(smartMergeNote({ executable: 'UnityYAMLMerge', editorVersion: '6000.3.19f1' }, 'VS Code')).toBe(
      "Smart Merge (Unity 6000.3.19f1) merges them first, without opening anything. VS Code opens only for what it can't merge.",
    );
  });

  it('reads well for an editor whose version is unknown, and without a merge tool', () => {
    expect(smartMergeNote({ executable: 'UnityYAMLMerge', editorVersion: '' }, undefined)).toBe(
      "Smart Merge (Unity) merges them first, without opening anything. The merge tool opens only for what it can't merge.",
    );
  });
});
