import { describe, expect, it } from 'vitest';
import type { MergeTool, MergeToolList } from '@shared/domain/mergeTools';
import {
  argsToSave,
  draftFields,
  draftOf,
  draftPatterns,
  editorOptions,
  fallbackChoices,
  resolvedToolId,
  ruleOf,
  savedDraft,
  saveProblem,
  toolChoices,
  withRule,
  withTool,
  type RuleDraft,
  type RuleTarget,
} from './mergeRuleDraft';

const tool = (id: string, name = id, changes: Partial<MergeTool> = {}): MergeTool => ({
  id,
  name,
  origin: 'known',
  executable: `/bin/${id}`,
  args: ['{base}', '{result}'],
  defaultArgs: ['{base}', '{result}'],
  canBringToFront: false,
  ...changes,
});
const merge = (editorVersion: string) => ({ id: `unityyamlmerge:${editorVersion}`, executable: `/Unity/${editorVersion}/UnityYAMLMerge`, editorVersion });
const list: MergeToolList = {
  tools: [tool('uvcs', 'UVCS merge tool'), tool('semantic', 'Semantic Merge'), tool('vscode', 'Visual Studio Code'), tool('custom:1', 'Mine', { origin: 'custom' })],
  preferredId: 'uvcs',
  knownNames: {},
  unityYamlMerges: [merge('6000.5.0f1'), merge('2022.3.10f1')],
};
const unityRule = { id: 'u', patterns: ['.unity', '.prefab'], toolId: 'unityyamlmerge:2022.3.10f1', fallbackToolId: 'vscode' };
const ruleTarget: RuleTarget = { kind: 'rule', rule: unityRule };
const newRule: RuleTarget = { kind: 'rule', rule: null };
const everyOtherFile: RuleTarget = { kind: 'everyOtherFile', mergeTool: 'auto' };
const draft = (changes: Partial<RuleDraft>): RuleDraft => ({ patterns: ['.cs'], toolId: 'semantic', editorId: 'unityyamlmerge', fallbackToolId: 'auto', argsText: null, pendingFiles: '', ...changes });

describe('the draft of a row', () => {
  it('starts a rule of UnityYAMLMerge with its editor and fallback apart, and saves it back the same', () => {
    const started = draftOf(ruleTarget, list);
    expect(started).toEqual({ patterns: ['.unity', '.prefab'], toolId: 'unityyamlmerge', editorId: 'unityyamlmerge:2022.3.10f1', fallbackToolId: 'vscode', argsText: null, pendingFiles: '' });
    expect(ruleOf(started, 'u')).toEqual(unityRule);
  });

  it('starts a new rule in the tool every other file opens in, with no file type; every other file as stored', () => {
    expect(draftOf(newRule, list)).toMatchObject({ patterns: [], toolId: 'uvcs' });
    expect(draftOf(everyOtherFile, list).toolId).toBe('auto');
  });

  it('saves a rule of another tool without a fallback, and shows a tool’s own arguments once another is picked', () => {
    expect(ruleOf(draft({ editorId: 'unityyamlmerge:2022.3.10f1', fallbackToolId: 'vscode' }), 'c')).toEqual({ id: 'c', patterns: ['.cs'], toolId: 'semantic' });
    expect(withTool(draft({ argsText: '{result}' }), 'vscode')).toMatchObject({ toolId: 'vscode', argsText: null });
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

describe('resolvedToolId', () => {
  it('is the tool stored while it’s found, else the one every other file falls back to, else none', () => {
    expect(resolvedToolId('vscode', list)).toBe('vscode');
    expect(resolvedToolId('unityyamlmerge', list)).toBe('unityyamlmerge');
    expect(resolvedToolId('auto', list)).toBe('uvcs');
    expect(resolvedToolId('gone', list)).toBe('uvcs');
    expect(resolvedToolId('auto', { ...list, tools: [], preferredId: null })).toBeNull();
  });
});

describe('draftFields', () => {
  it('shows the files and, for UnityYAMLMerge, its editor and fallback, with no arguments (they are fixed)', () => {
    expect(draftFields(ruleTarget, draftOf(ruleTarget, list), list)).toMatchObject({
      title: 'File types',
      files: true,
      shownToolId: 'unityyamlmerge',
      unityYamlMerge: true,
      shownFallbackId: 'vscode',
      args: undefined,
    });
  });

  it('shows "How <tool> opens" for a tool: its arguments, Back to its own when they differ, Remove for the user’s own', () => {
    expect(draftFields(ruleTarget, draft({}), list).args).toMatchObject({ tool: { id: 'semantic' }, text: '{base} {result}', problem: undefined, canGoBack: false, remove: undefined });
    expect(draftFields(ruleTarget, draft({ argsText: '--out {result}' }), list).args).toMatchObject({ canGoBack: true });
    expect(draftFields(ruleTarget, draft({ toolId: 'custom:1', argsText: '--out {result}' }), list).args).toMatchObject({ canGoBack: false });
  });

  it('removes a tool the user added everywhere, saying the rows that open in it go too', () => {
    expect(draftFields(ruleTarget, draft({ toolId: 'custom:1' }), list).args!.remove).toEqual({ label: 'Remove Mine', tip: 'Removes Mine, and every row that opens in it' });
  });

  it('shows the tool every other file really opens in, and its arguments, with no files', () => {
    expect(draftFields(everyOtherFile, draftOf(everyOtherFile, list), list)).toMatchObject({ title: 'Every other file', files: false, shownToolId: 'uvcs', args: { tool: { id: 'uvcs' } } });
  });
});

describe('a tool that isn’t here', () => {
  const noUnity = { ...list, unityYamlMerges: [] };

  it('is UnityYAMLMerge for a Unity rule on a computer with no Unity Editor, as the row says', () => {
    expect(draftFields(ruleTarget, draftOf(ruleTarget, noUnity), noUnity)).toMatchObject({ shownToolId: 'unityyamlmerge', toolMissingName: 'UnityYAMLMerge' });
  });

  it('is no tool found when none was', () => {
    const none = { ...list, tools: [], preferredId: null };
    expect(draftFields(everyOtherFile, draftOf(everyOtherFile, none), none)).toMatchObject({ toolMissingName: 'No merge tool found', fallbackMissingName: 'No merge tool found' });
  });
});

describe('filesHint', () => {
  it('asks for a file type while there is none, as Save does, and says what the field takes once there is', () => {
    const empty = draftOf(newRule, list);
    expect(draftFields(newRule, empty, list).filesHint).toBe(saveProblem(newRule, empty, draftFields(newRule, empty, list)));
    expect(draftFields(ruleTarget, draftOf(ruleTarget, list), list).filesHint).toBe('Extensions, names or paths. Enter, a space or a comma adds one.');
  });
});

describe('file types typed but not chips yet', () => {
  it('count: Save is on, and saves them as chips, each once', () => {
    const typed = draft({ patterns: [], pendingFiles: '.psd' });
    expect(saveProblem(newRule, typed, draftFields(newRule, typed, list))).toBeUndefined();
    expect(draftFields(newRule, typed, list).filesHint).not.toBe('Add at least one file type');
    expect(ruleOf(draft({ patterns: ['.cs'], pendingFiles: '.cs .vb' }), 'c').patterns).toEqual(['.cs', '.vb']);
    expect(draftPatterns(draft({ patterns: ['.cs'], pendingFiles: '  ' }))).toEqual(['.cs']);
  });
});

describe('saving', () => {
  it('asks a rule for a file type, and arguments that save the merge somewhere', () => {
    const empty = draftOf(newRule, list);
    expect(saveProblem(newRule, empty, draftFields(newRule, empty, list))).toBe('Add at least one file type');
    const noResult = draft({ argsText: '{base}' });
    expect(saveProblem(ruleTarget, noResult, draftFields(ruleTarget, noResult, list))).toBe('Include {result}: the file the tool saves the merge to.');
    expect(saveProblem(everyOtherFile, draftOf(everyOtherFile, list), draftFields(everyOtherFile, draftOf(everyOtherFile, list), list))).toBeUndefined();
  });

  it('saves the arguments only when they were edited into something else', () => {
    expect(argsToSave(draftFields(ruleTarget, draft({}), list))).toBeUndefined();
    expect(argsToSave(draftFields(ruleTarget, draft({ argsText: '{base}  {result}' }), list))).toBeUndefined();
    expect(argsToSave(draftFields(ruleTarget, draft({ argsText: '--out {result}' }), list))).toEqual({ tool: list.tools[1], args: ['--out', '{result}'] });
  });

  it('stores a rule’s real tool, and leaves every other file’s `auto` alone until one is picked', () => {
    const fresh = draft({ toolId: 'auto' });
    expect(savedDraft(newRule, fresh, draftFields(newRule, fresh, list)).toolId).toBe('uvcs');
    const stored = draftOf(everyOtherFile, list);
    expect(savedDraft(everyOtherFile, stored, draftFields(everyOtherFile, stored, list)).toolId).toBe('auto');
  });
});

describe('toolChoices', () => {
  it('lists each tool once, UnityYAMLMerge after Semantic Merge, for a rule', () => {
    const choices = toolChoices(ruleTarget, list, 'unityyamlmerge');
    expect(choices.map((choice) => choice.name)).toEqual(['UVCS merge tool', 'Semantic Merge', 'UnityYAMLMerge', 'Visual Studio Code', 'Mine']);
    expect(choices[2]!.tip).toContain("Unity's Smart Merge");
  });

  it('shows the path of the UnityYAMLMerge that runs: the newest editor’s, or the one picked, as other tools show theirs', () => {
    const pathOf = (editorId: string) => toolChoices(ruleTarget, list, editorId).find((choice) => choice.id === 'unityyamlmerge')!.location;
    expect(pathOf('unityyamlmerge')).toBe('/Unity/6000.5.0f1/UnityYAMLMerge');
    expect(pathOf('unityyamlmerge:2022.3.10f1')).toBe('/Unity/2022.3.10f1/UnityYAMLMerge');
    expect(pathOf('unityyamlmerge:2019.4.0f1')).toBe('Not found on this computer');
    expect(toolChoices(ruleTarget, list, 'unityyamlmerge')[0]!.location).toBe('/bin/uvcs');
  });

  it('offers no UnityYAMLMerge for every other file, nor without a Unity Editor, nor as a fallback', () => {
    expect(toolChoices(everyOtherFile, list, 'unityyamlmerge').map((choice) => choice.id)).not.toContain('unityyamlmerge');
    expect(toolChoices(ruleTarget, { ...list, unityYamlMerges: [] }, 'unityyamlmerge').map((choice) => choice.id)).not.toContain('unityyamlmerge');
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
