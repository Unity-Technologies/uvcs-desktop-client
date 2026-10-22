import { describe, expect, it } from 'vitest';
import type { MergeTool, MergeToolList, MergeToolRule } from '@shared/domain/mergeTools';
import { commandLine, EVERY_OTHER_FILE, fitFileTypes, mergeToolRows } from './mergeToolRows';

const tool = (id: string, name = id, origin: MergeTool['origin'] = 'known'): MergeTool => ({
  id,
  name,
  origin,
  executable: `/Applications/${name}.app/Contents/MacOS/${id}`,
  args: ['{base}', '{result}'],
  defaultArgs: ['{base}', '{result}'],
  canBringToFront: false,
});
const merge = (editorVersion: string) => ({ id: `unityyamlmerge:${editorVersion}`, executable: `/Unity/${editorVersion}/UnityYAMLMerge`, editorVersion });
const list: MergeToolList = {
  tools: [tool('uvcs', 'UVCS merge tool'), tool('semantic', 'Semantic Merge'), tool('rider', 'JetBrains Rider'), tool('custom:1', 'My Diff', 'custom')],
  preferredId: 'uvcs',
  knownNames: { kdiff3: 'KDiff3' },
  unityYamlMerges: [merge('6000.5.0f1'), merge('2022.3.10f1')],
};
const UNITY = ['.unity', '.prefab', '.asset', '.mat', '.anim', '.controller', '.overrideController', '.physicMaterial', '.lighting', '.mixer', '.playable', '.preset', '.spriteatlas', '.terrainlayer', '.signal'];

/** The rows as they read, one line each: files, "+N", tool, its quieter detail, and whether it's missing. */
const reading = (rules: MergeToolRule[], mergeTool = 'auto', tools = list) =>
  mergeToolRows(rules, mergeTool, tools).map((row) => [row.files, row.moreFiles, row.toolName, row.toolDetail, row.missing]);

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

describe('commandLine', () => {
  it('writes the program and its arguments as one line, quoting what holds a space', () => {
    expect(commandLine('/Applications/Visual Studio Code.app/code', ['--wait', '--merge', '{incoming}'])).toBe('"/Applications/Visual Studio Code.app/code" --wait --merge {incoming}');
    expect(commandLine('C:\\Tools\\kdiff3.exe', ['--L1', 'Base (main)'])).toBe('C:\\Tools\\kdiff3.exe --L1 "Base (main)"');
  });
});

describe('mergeToolRows', () => {
  it('reads each rule, then every other file, last, each on one line', () => {
    const rows = mergeToolRows([{ id: 'code', patterns: ['.cs', '.vb', '.java'], toolId: 'semantic' }], 'auto', list);
    expect(rows.map((row) => row.id)).toEqual(['code', EVERY_OTHER_FILE]);
    expect(rows.map((row) => row.filesAreCode)).toEqual([true, false]);
  });

  it('names UnityYAMLMerge, the editor a row pins after it, and its command line and fallback in the tooltip', () => {
    const rows = mergeToolRows(
      [
        { id: 'u', patterns: UNITY, toolId: 'unityyamlmerge', fallbackToolId: 'auto' },
        { id: 'p', patterns: ['.prefab'], toolId: 'unityyamlmerge:2022.3.10f1', fallbackToolId: 'rider' },
      ],
      'auto',
      list,
    );
    expect(rows.slice(0, 2).map((row) => [row.files, row.moreFiles, row.toolName, row.toolDetail])).toEqual([
      ['.unity .prefab', 13, 'UnityYAMLMerge', undefined],
      ['.prefab', 0, 'UnityYAMLMerge', '2022.3.10f1'],
    ]);
    expect(rows[0]!.toolTip).toBe('/Unity/6000.5.0f1/UnityYAMLMerge merge -h --force --fallback none {base} {incoming} {yours} {result}\nIf it can\'t merge: UVCS merge tool');
    expect(rows[1]!.toolTip).toContain("If it can't merge: JetBrains Rider");
  });

  it('shows a tool, or an editor, that isn’t on this computer as missing, saying why in its tooltip', () => {
    const rows = mergeToolRows(
      [
        { id: 'k', patterns: ['.txt'], toolId: 'kdiff3' },
        { id: 'u', patterns: ['.prefab'], toolId: 'unityyamlmerge:2019.4.0f1' },
      ],
      'auto',
      list,
    );
    expect(rows.slice(0, 2).map((row) => [row.toolName, row.missing, row.toolTip])).toEqual([
      ['KDiff3', true, 'Not found on this computer'],
      ['UnityYAMLMerge', true, 'Not found on this computer: no Unity Editor 2019.4.0f1'],
    ]);
  });

  it('shows a tool’s command line in its tooltip, a tool the user added like any', () => {
    const [row] = mergeToolRows([{ id: 'd', patterns: ['.txt'], toolId: 'custom:1' }], 'auto', list);
    expect(row).toMatchObject({ toolName: 'My Diff', missing: false, toolTip: '"/Applications/My Diff.app/Contents/MacOS/custom:1" {base} {result}' });
  });

  it('names the tool every other file really opens in: the one picked, else the one it resolves to', () => {
    expect(reading([], 'rider')).toEqual([['Every other file', 0, 'JetBrains Rider', undefined, false]]);
    expect(reading([], 'auto')).toEqual([['Every other file', 0, 'UVCS merge tool', undefined, false]]);
    expect(reading([], 'gone')).toEqual([['Every other file', 0, 'UVCS merge tool', undefined, false]]);
  });

  it('says when no merge tool was found at all', () => {
    expect(reading([], 'auto', { ...list, tools: [], preferredId: null })).toEqual([['Every other file', 0, 'No merge tool found', undefined, true]]);
  });

  it('keeps every file type in the row’s tooltip', () => {
    const [row] = mergeToolRows([{ id: 'u', patterns: UNITY, toolId: 'unityyamlmerge' }], 'auto', list);
    expect(row!.filesTip).toBe(UNITY.join(' '));
  });
});
