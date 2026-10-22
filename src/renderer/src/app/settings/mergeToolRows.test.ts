import { describe, expect, it } from 'vitest';
import type { MergeTool, MergeToolList, MergeToolRule } from '@shared/domain/mergeTools';
import { commandLine, EVERY_OTHER_FILE, missingToolName, rowTarget, fitFileTypes, fitsWidth, GUESSED_FIT, mergeToolRows } from './mergeToolRows';

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

/** A column `chars` characters of the code font wide, every character 7.2 pixels as the font draws them. */
const column = (chars: number) => fitsWidth(chars * 7.2, (text) => text.length * 7.2);

describe('fitFileTypes', () => {
  it('shows every file type that fits the column, then " +N" for the rest, the count and its space counted in', () => {
    expect(fitFileTypes(['.cs', '.vb', '.java'], column(24))).toEqual({ shown: '.cs .vb .java', more: 0 });
    expect(fitFileTypes(UNITY, column(24))).toEqual({ shown: '.unity .prefab', more: 13 });
    // ".unity .prefab .asset .mat +11" is 30 characters: it fits 30, not 29.
    expect(fitFileTypes(UNITY, column(30))).toEqual({ shown: '.unity .prefab .asset .mat', more: 11 });
    expect(fitFileTypes(UNITY, column(29))).toEqual({ shown: '.unity .prefab .asset', more: 12 });
  });

  it('fills most of a wide column: at the default Settings width, about 215 pixels', () => {
    const { shown, more } = fitFileTypes(UNITY, fitsWidth(215, (text) => text.length * 7.2));
    expect(`${shown} +${more}`.length * 7.2).toBeGreaterThan(215 * 0.8);
  });

  it('shows the first file type however long, and quotes one with a space', () => {
    expect(fitFileTypes(['Assets/Very/Long/Folder/Name/**', '.cs'], column(10))).toEqual({ shown: 'Assets/Very/Long/Folder/Name/**', more: 1 });
    expect(fitFileTypes(['My Art/**'], column(24))).toEqual({ shown: '"My Art/**"', more: 0 });
    expect(fitFileTypes([], column(24))).toEqual({ shown: '', more: 0 });
  });

  it('guesses about 24 characters until the column is measured', () => {
    expect(fitFileTypes(UNITY, GUESSED_FIT)).toEqual({ shown: '.unity .prefab', more: 13 });
  });
});

describe('missingToolName', () => {
  it('names UnityYAMLMerge by its ids, a known tool by its name, a tool of the user’s removed as such, and nothing as none found', () => {
    expect(['unityyamlmerge', 'unityyamlmerge:2019.4.0f1', 'kdiff3', 'custom:9'].map((id) => missingToolName(id, list))).toEqual(['UnityYAMLMerge', 'UnityYAMLMerge', 'KDiff3', 'A tool removed']);
    expect(missingToolName(null, list)).toBe('No merge tool found');
  });
});

describe('commandLine', () => {
  it('writes the program and its arguments as one line, quoting what holds a space', () => {
    expect(commandLine('/Applications/Visual Studio Code.app/code', ['--wait', '--merge', '{incoming}'])).toBe('"/Applications/Visual Studio Code.app/code" --wait --merge {incoming}');
    expect(commandLine('C:\\Tools\\kdiff3.exe', ['--L1', 'Base (main)'])).toBe('C:\\Tools\\kdiff3.exe --L1 "Base (main)"');
  });
});

describe('mergeToolRows', () => {
  it('fits each row’s file types to its column', () => {
    const [row] = mergeToolRows([{ id: 'u', patterns: UNITY, toolId: 'unityyamlmerge' }], 'auto', list, column(40));
    expect([row!.files, row!.moreFiles]).toEqual(['.unity .prefab .asset .mat .anim', 10]);
  });

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

  it('says a Unity row is missing on a computer with no Unity Editor, why in its tooltip', () => {
    const [row] = mergeToolRows([{ id: 'u', patterns: UNITY, toolId: 'unityyamlmerge' }], 'auto', { ...list, unityYamlMerges: [] });
    expect(row).toMatchObject({ toolName: 'UnityYAMLMerge', missing: true, toolTip: 'Not found on this computer: no Unity Editor' });
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

  it('labels each row for screen readers by every file type and its tool, and its menu by the file types', () => {
    const [rule, others] = mergeToolRows([{ id: 'u', patterns: UNITY, toolId: 'unityyamlmerge' }], 'auto', list);
    expect(rule).toMatchObject({ label: `${UNITY.join(' ')}: UnityYAMLMerge. Edit`, menuLabel: `More for ${UNITY.join(' ')}` });
    expect(others).toMatchObject({ label: 'Every other file: UVCS merge tool. Edit', menuLabel: 'More for Every other file' });
  });

  it('edits a row’s rule, or every other file’s tool as stored', () => {
    const rules = [{ id: 'c', patterns: ['.cs'], toolId: 'semantic' }];
    expect(rowTarget('c', rules, 'auto')).toEqual({ kind: 'rule', rule: rules[0] });
    expect(rowTarget(EVERY_OTHER_FILE, rules, 'rider')).toEqual({ kind: 'everyOtherFile', mergeTool: 'rider' });
  });

  it('keeps every file type in the row’s tooltip', () => {
    const [row] = mergeToolRows([{ id: 'u', patterns: UNITY, toolId: 'unityyamlmerge' }], 'auto', list);
    expect(row!.filesTip).toBe(UNITY.join(' '));
  });
});
