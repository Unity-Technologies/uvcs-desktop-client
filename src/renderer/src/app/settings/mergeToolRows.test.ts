import { describe, expect, it } from 'vitest';
import type { MergeTool, MergeToolList, MergeToolRule } from '@shared/domain/mergeTools';
import { AUTOMATIC_CHOICE_ICON } from './automaticApp';
import { EVERY_OTHER_FILE, fitFileTypes, mergeToolRows } from './mergeToolRows';

const tool = (id: string, name = id): MergeTool => ({ id, name, origin: 'known', executable: `/bin/${id}`, args: [], defaultArgs: [], canBringToFront: false });
const merge = (editorVersion: string) => ({ id: `unityyamlmerge:${editorVersion}`, executable: `/Unity/${editorVersion}/UnityYAMLMerge`, editorVersion });
const list: MergeToolList = {
  tools: [tool('uvcs', 'UVCS merge tool'), tool('semantic', 'Semantic Merge'), tool('rider', 'JetBrains Rider')],
  preferredId: 'uvcs',
  knownNames: { kdiff3: 'KDiff3' },
  unityYamlMerges: [merge('6000.5.0f1'), merge('2022.3.10f1')],
};
const UNITY = ['.unity', '.prefab', '.asset', '.mat', '.anim', '.controller', '.overrideController', '.physicMaterial', '.lighting', '.mixer', '.playable', '.preset', '.spriteatlas', '.terrainlayer', '.signal'];

/** The rows as they read: files, "+N", tool, and the note under it. */
const reading = (rules: MergeToolRule[], mergeTool = 'auto') =>
  mergeToolRows(rules, mergeTool, list).map((row) => [row.files, row.moreFiles, row.toolName, row.toolNote]);

describe('fitFileTypes', () => {
  it('shows every file type that fits, then how many more, the count counted in', () => {
    expect(fitFileTypes(['.cs', '.vb', '.java'], 24)).toEqual({ shown: '.cs .vb .java', more: 0 });
    expect(fitFileTypes(UNITY, 24)).toEqual({ shown: '.unity .prefab', more: 13 });
    expect(fitFileTypes(UNITY, 30)).toEqual({ shown: '.unity .prefab .asset .mat', more: 11 });
  });

  it('shows the first file type however long, and quotes one with a space', () => {
    expect(fitFileTypes(['Assets/Very/Long/Folder/Name/**', '.cs'], 10)).toEqual({ shown: 'Assets/Very/Long/Folder/Name/**', more: 1 });
    expect(fitFileTypes(['My Art/**'], 24)).toEqual({ shown: '"My Art/**"', more: 0 });
    expect(fitFileTypes([], 24)).toEqual({ shown: '', more: 0 });
  });
});

describe('mergeToolRows', () => {
  it('reads each rule, then every other file, last', () => {
    const rows = mergeToolRows([{ id: 'code', patterns: ['.cs', '.vb', '.java'], toolId: 'semantic' }], 'auto', list);
    expect(rows.map((row) => row.id)).toEqual(['code', EVERY_OTHER_FILE]);
    expect(rows.map((row) => row.filesAreCode)).toEqual([true, false]);
  });

  it('says what UnityYAMLMerge falls back to, and which editor’s a row pins', () => {
    expect(
      reading([
        { id: 'u', patterns: UNITY, toolId: 'unityyamlmerge', fallbackToolId: 'auto' },
        { id: 'p', patterns: ['.prefab'], toolId: 'unityyamlmerge:2022.3.10f1', fallbackToolId: 'rider' },
      ]).slice(0, 2),
    ).toEqual([
      ['.unity .prefab', 13, 'UnityYAMLMerge', 'else UVCS merge tool'],
      ['.prefab', 0, 'UnityYAMLMerge', '2022.3.10f1, else JetBrains Rider'],
    ]);
  });

  it('says when a row’s tool, or its editor, isn’t on this computer', () => {
    expect(
      reading([
        { id: 'k', patterns: ['.txt'], toolId: 'kdiff3' },
        { id: 'u', patterns: ['.prefab'], toolId: 'unityyamlmerge:2019.4.0f1' },
      ]).slice(0, 2),
    ).toEqual([
      ['.txt', 0, 'KDiff3', 'Not found on this computer'],
      ['.prefab', 0, 'UnityYAMLMerge', 'Not found on this computer'],
    ]);
  });

  it('shows Automatic with its own icon and what it uses for every other file, or the tool picked', () => {
    const [automatic] = mergeToolRows([], 'auto', list);
    expect(automatic).toMatchObject({ files: 'Every other file', toolName: 'Automatic', toolNote: 'UVCS merge tool', toolIcon: AUTOMATIC_CHOICE_ICON });
    expect(reading([], 'rider')).toEqual([['Every other file', 0, 'JetBrains Rider', undefined]]);
  });

  it('keeps every file type in the row’s tooltip', () => {
    const [row] = mergeToolRows([{ id: 'u', patterns: UNITY, toolId: 'unityyamlmerge' }], 'auto', list);
    expect(row!.filesTip).toBe(UNITY.join(' '));
  });
});
