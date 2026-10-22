import { describe, expect, it } from 'vitest';
import { editorVersionOf, isUnityYamlMergeId, unityYamlMergeId, unityYamlMergeOf, type UnityYamlMergeTool } from './mergeTools';

const merge = (editorVersion: string): UnityYamlMergeTool => ({ id: unityYamlMergeId(editorVersion), executable: `/Unity/${editorVersion}/UnityYAMLMerge`, editorVersion });
const installed = [merge('6000.3.19f1'), merge('2022.3.10f1')];

describe('UnityYAMLMerge ids', () => {
  it('names the newest editor’s, or one editor’s by its version', () => {
    expect(unityYamlMergeOf(installed, 'unityyamlmerge')).toBe(installed[0]);
    expect(unityYamlMergeOf(installed, 'unityyamlmerge:2022.3.10f1')).toBe(installed[1]);
  });

  it('finds none for an editor no longer installed, or without any', () => {
    expect(unityYamlMergeOf(installed, 'unityyamlmerge:2019.4.0f1')).toBeUndefined();
    expect(unityYamlMergeOf([], 'unityyamlmerge')).toBeUndefined();
  });

  it('tells UnityYAMLMerge from the tools that open a window', () => {
    expect(['unityyamlmerge', 'unityyamlmerge:2022.3.10f1', 'uvcs', 'custom:1'].map(isUnityYamlMergeId)).toEqual([true, true, false, false]);
  });

  it('reads the version a pinned id names, and none for the newest editor’s', () => {
    expect(editorVersionOf('unityyamlmerge:2022.3.10f1')).toBe('2022.3.10f1');
    expect(editorVersionOf('unityyamlmerge')).toBeUndefined();
    expect(editorVersionOf('uvcs')).toBeUndefined();
  });
});
