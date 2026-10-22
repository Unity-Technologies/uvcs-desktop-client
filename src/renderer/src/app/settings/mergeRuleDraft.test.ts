import { describe, expect, it } from 'vitest';
import type { MergeTool, MergeToolList } from '@shared/domain/mergeTools';
import { draftFields, draftOf, editorOptions, fallbackChoices, ruleOf, saveProblem, toolChoices, withRule, type RuleTarget } from './mergeRuleDraft';

const tool = (id: string, name = id): MergeTool => ({ id, name, origin: 'known', executable: `/bin/${id}`, args: [], defaultArgs: [], canBringToFront: false });
const merge = (editorVersion: string) => ({ id: `unityyamlmerge:${editorVersion}`, executable: `/Unity/${editorVersion}/UnityYAMLMerge`, editorVersion });
const list: MergeToolList = {
  tools: [tool('uvcs', 'UVCS merge tool'), tool('semantic', 'Semantic Merge'), tool('vscode', 'Visual Studio Code'), tool('custom:1', 'Mine')],
  preferredId: 'uvcs',
  knownNames: {},
  unityYamlMerges: [merge('6000.5.0f1'), merge('2022.3.10f1')],
};
const unityRule = { id: 'u', patterns: ['.unity', '.prefab'], toolId: 'unityyamlmerge:2022.3.10f1', fallbackToolId: 'vscode' };
const ruleTarget: RuleTarget = { kind: 'rule', rule: unityRule };
const newRule: RuleTarget = { kind: 'rule', rule: null };
const everyOtherFile: RuleTarget = { kind: 'everyOtherFile', mergeTool: 'auto' };

describe('the draft of a row', () => {
  it('starts a rule of UnityYAMLMerge with its editor and fallback apart, and saves it back the same', () => {
    const draft = draftOf(ruleTarget, list);
    expect(draft).toEqual({ patterns: ['.unity', '.prefab'], toolId: 'unityyamlmerge', editorId: 'unityyamlmerge:2022.3.10f1', fallbackToolId: 'vscode' });
    expect(ruleOf(draft, 'u')).toEqual(unityRule);
  });

  it('starts a new rule in every other file’s tool, with no file type, and every other file as set', () => {
    expect(draftOf(newRule, list)).toEqual({ patterns: [], toolId: 'uvcs', editorId: 'unityyamlmerge', fallbackToolId: 'auto' });
    expect(draftOf(everyOtherFile, list).toolId).toBe('auto');
  });

  it('saves a rule of another tool without a fallback', () => {
    expect(ruleOf({ patterns: ['.cs'], toolId: 'semantic', editorId: 'unityyamlmerge:2022.3.10f1', fallbackToolId: 'vscode' }, 'c')).toEqual({ id: 'c', patterns: ['.cs'], toolId: 'semantic' });
  });

  it('puts a rule saved back in its place, and a new one last', () => {
    const rules = [unityRule, { id: 'c', patterns: ['.cs'], toolId: 'semantic' }];
    expect(withRule(rules, { ...unityRule, patterns: ['.mat'] }).map((rule) => [rule.id, rule.patterns])).toEqual([
      ['u', ['.mat']],
      ['c', ['.cs']],
    ]);
    expect(withRule(rules, { id: 'n', patterns: ['.psd'], toolId: 'uvcs' }).map((rule) => rule.id)).toEqual(['u', 'c', 'n']);
  });
});

describe('draftFields', () => {
  it('shows the files and, for UnityYAMLMerge, its editor and fallback; how a tool opens only for a tool found', () => {
    expect(draftFields(ruleTarget, draftOf(ruleTarget, list), list)).toMatchObject({ title: 'File types', files: true, unityYamlMerge: true, automatic: false, howItOpens: undefined });
    const semantic = { ...draftOf(ruleTarget, list), toolId: 'semantic' };
    expect(draftFields(ruleTarget, semantic, list)).toMatchObject({ unityYamlMerge: false, howItOpens: { id: 'semantic' } });
  });

  it('shows only "Opens in", with Automatic, for every other file', () => {
    expect(draftFields(everyOtherFile, draftOf(everyOtherFile, list), list)).toEqual({ title: 'Every other file', files: false, unityYamlMerge: false, automatic: true, howItOpens: undefined });
  });
});

describe('saveProblem', () => {
  it('asks a rule for a file type, and never every other file', () => {
    expect(saveProblem(newRule, draftOf(newRule, list))).toBe('Add at least one file type');
    expect(saveProblem(ruleTarget, draftOf(ruleTarget, list))).toBeUndefined();
    expect(saveProblem(everyOtherFile, draftOf(everyOtherFile, list))).toBeUndefined();
  });
});

describe('toolChoices', () => {
  it('lists each tool once, UnityYAMLMerge after Semantic Merge with the newest editor’s version, for a rule', () => {
    const choices = toolChoices(ruleTarget, list);
    expect(choices.map((choice) => choice.name)).toEqual(['UVCS merge tool', 'Semantic Merge', 'UnityYAMLMerge', 'Visual Studio Code', 'Mine']);
    expect(choices[2]).toMatchObject({ id: 'unityyamlmerge', location: 'Unity 6000.5.0f1' });
    expect(choices[2]!.tip).toContain("Unity's Smart Merge");
  });

  it('offers no UnityYAMLMerge for every other file, nor without a Unity Editor, nor as a fallback', () => {
    expect(toolChoices(everyOtherFile, list).map((choice) => choice.id)).not.toContain('unityyamlmerge');
    expect(toolChoices(ruleTarget, { ...list, unityYamlMerges: [] }).map((choice) => choice.id)).not.toContain('unityyamlmerge');
    expect(fallbackChoices(list).map((choice) => choice.id)).toEqual(['uvcs', 'semantic', 'vscode', 'custom:1']);
  });
});

describe('editorOptions', () => {
  it('offers the newest installed first, then each installed version', () => {
    expect(editorOptions(list, 'unityyamlmerge')).toEqual([
      { value: 'unityyamlmerge', label: 'Newest installed (6000.5.0f1)' },
      { value: 'unityyamlmerge:6000.5.0f1', label: '6000.5.0f1' },
      { value: 'unityyamlmerge:2022.3.10f1', label: '2022.3.10f1' },
    ]);
  });

  it('keeps a version picked that is no longer installed, saying so', () => {
    expect(editorOptions(list, 'unityyamlmerge:2019.4.0f1').at(-1)).toEqual({ value: 'unityyamlmerge:2019.4.0f1', label: '2019.4.0f1 (not found on this computer)' });
    expect(editorOptions({ ...list, unityYamlMerges: [] }, 'unityyamlmerge')).toEqual([{ value: 'unityyamlmerge', label: 'Newest installed' }]);
  });
});

