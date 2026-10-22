import { describe, expect, it } from 'vitest';
import type { MergeToolRule } from '@shared/domain/mergeTools';
import { SEPARATOR, type Action } from '../../lib/actions';
import { addRule, AUTOMATIC_MERGE_TOOL_CHOICE, changedPatterns, changeRule, hasFallback, howItOpensEntries, missingToolName, pickableTools, moveRule, newRuleToolId, removeRule, ruleMenuEntries, ruleName, toolInUse } from './mergeToolRules';
import type { MergeTool, MergeToolList } from '@shared/domain/mergeTools';

const rule = (id: string): MergeToolRule => ({ id, patterns: [`.${id}`], toolId: 'uvcs' });
const rules = [rule('a'), rule('b'), rule('c')];
const ids = (list: MergeToolRule[]): string[] => list.map((each) => each.id);

describe('the rules of Settings › Merge', () => {
  it('adds a row at the end, with no file type yet and the tool given', () => {
    expect(addRule(rules, 'd', 'meld').at(-1)).toEqual({ id: 'd', patterns: [], toolId: 'meld' });
  });

  it('moves a row one place, never past the ends', () => {
    expect(ids(moveRule(rules, 'b', -1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveRule(rules, 'b', 1))).toEqual(['a', 'c', 'b']);
    expect(ids(moveRule(rules, 'a', -1))).toEqual(['a', 'b', 'c']);
    expect(ids(moveRule(rules, 'c', 1))).toEqual(['a', 'b', 'c']);
  });

  it('removes a row, and changes one’s file types or tool alone', () => {
    expect(ids(removeRule(rules, 'b'))).toEqual(['a', 'c']);
    expect(changeRule(rules, 'b', { patterns: ['.psd'] })[1]).toEqual({ id: 'b', patterns: ['.psd'], toolId: 'uvcs' });
    expect(changeRule(rules, 'b', { toolId: 'meld' })[1]).toEqual({ id: 'b', patterns: ['.b'], toolId: 'meld' });
    expect(changeRule(rules, 'b', { toolId: 'meld' })[0]).toBe(rules[0]);
  });

  it('offers moving a row up or down where it can go, and removing it', () => {
    const saved: string[][] = [];
    const menu = (id: string) => ruleMenuEntries(rules, id, (changed) => saved.push(ids(changed)));
    const reading = (id: string) => menu(id).map((entry) => (entry === SEPARATOR ? '---' : `${(entry as Action).label}${(entry as Action).disabled ? ' (disabled)' : ''}`));

    expect(reading('a')).toEqual(['Move up (disabled)', 'Move down', '---', 'Remove']);
    expect(reading('c')).toEqual(['Move up', 'Move down (disabled)', '---', 'Remove']);
    (menu('b')[0] as Action).run();
    (menu('b')[3] as Action).run();
    expect(saved).toEqual([
      ['b', 'a', 'c'],
      ['a', 'c'],
    ]);
  });
});

describe('toolInUse', () => {
  const tool = (id: string): MergeTool => ({ id, name: id, origin: 'known', executable: id, args: [], defaultArgs: [], canBringToFront: false });
  const list: MergeToolList = { tools: [tool('uvcs'), tool('meld')], preferredId: 'uvcs', knownNames: {}, unityYamlMerges: [] };

  it('is the tool picked, or every other file’s for a choice that picks for the user', () => {
    expect(toolInUse(list, 'meld', null)?.id).toBe('meld');
    expect(toolInUse(list, 'auto', AUTOMATIC_MERGE_TOOL_CHOICE)?.id).toBe('uvcs');
  });

  it('is none while the tool a row picked isn’t found here, but where Automatic stands for it', () => {
    expect(toolInUse(list, 'semantic', null)).toBeUndefined();
    expect(toolInUse(list, 'kdiff3', AUTOMATIC_MERGE_TOOL_CHOICE)?.id).toBe('uvcs');
  });

  it('gives a new row every other file’s tool, else the first found', () => {
    expect(newRuleToolId(list)).toBe('uvcs');
    expect(newRuleToolId({ ...list, preferredId: null })).toBe('uvcs');
    expect(newRuleToolId({ ...list, preferredId: null, tools: [] })).toBe('');
  });
});

describe('ruleName', () => {
  it('names a row by its patterns, or as new before it has any', () => {
    expect(ruleName({ id: 'a', patterns: ['.cs', '.vb'], toolId: 'semantic' })).toBe('.cs .vb');
    expect(ruleName({ id: 'a', patterns: [], toolId: 'semantic' })).toBe('New file type');
  });
});

describe('changedPatterns', () => {
  const shaders: MergeToolRule = { id: 's', patterns: ['.shader', '.hlsl'], toolId: 'rider' };

  it('reads the field once left, and is null when it holds the row’s patterns already, however typed', () => {
    expect(changedPatterns('.shader, .hlsl ', shaders)).toBeNull();
    expect(changedPatterns('.shader .cginc', shaders)).toEqual(['.shader', '.cginc']);
    expect(changedPatterns('', shaders)).toEqual([]);
  });
});

describe('howItOpensEntries', () => {
  it('offers editing how the tool in use opens, and nothing while none is found', () => {
    const meld = { id: 'meld', name: 'Meld', origin: 'known', executable: 'meld', args: [], defaultArgs: [], canBringToFront: false } as MergeTool;
    const opened: string[] = [];
    const [entry] = howItOpensEntries(meld, (tool) => opened.push(tool.id)) as Action[];
    expect(entry!.label).toBe('How Meld opens…');
    entry!.run();
    expect(opened).toEqual(['meld']);
    expect(howItOpensEntries(undefined, () => {})).toEqual([]);
  });
});

describe('pickableTools', () => {
  const tool = (id: string): MergeTool => ({ id, name: id, origin: 'known', executable: `/bin/${id}`, args: [], defaultArgs: [], canBringToFront: false });
  const merge = (editorVersion: string) => ({ id: `unityyamlmerge:${editorVersion}`, executable: `/Unity/${editorVersion}/UnityYAMLMerge`, editorVersion });
  const list: MergeToolList = { tools: [tool('uvcs'), tool('meld')], preferredId: 'uvcs', knownNames: { semantic: 'Semantic Merge' }, unityYamlMerges: [merge('6000.3.19f1'), merge('2022.3.10f1')] };

  it('lists the tools found, and for a row’s own tool UnityYAMLMerge: the newest editor’s, then each editor’s', () => {
    expect(pickableTools(list, true).map(({ id, name, detail, startsGroup }) => [id, name, detail, startsGroup])).toEqual([
      ['uvcs', 'uvcs', undefined, undefined],
      ['meld', 'meld', undefined, undefined],
      ['unityyamlmerge', 'UnityYAMLMerge', 'Newest editor', true],
      ['unityyamlmerge:6000.3.19f1', 'UnityYAMLMerge', '6000.3.19f1', undefined],
      ['unityyamlmerge:2022.3.10f1', 'UnityYAMLMerge', '2022.3.10f1', undefined],
    ]);
    expect(pickableTools(list, true)[2]).toMatchObject({ location: "Unity's Smart Merge, from Unity 6000.3.19f1" });
  });

  it('lists the tools alone for a fallback or every other file, and without a Unity Editor', () => {
    expect(pickableTools(list, false).map((app) => app.id)).toEqual(['uvcs', 'meld']);
    expect(pickableTools({ ...list, unityYamlMerges: [] }, true).map((app) => app.id)).toEqual(['uvcs', 'meld']);
  });

  it('names a tool picked that isn’t here: a known one by its name, UnityYAMLMerge from an editor gone as UnityYAMLMerge', () => {
    expect(missingToolName(list, 'semantic')).toBe('Semantic Merge');
    expect(missingToolName(list, 'unityyamlmerge:2019.4.0f1')).toBe('UnityYAMLMerge');
    expect(missingToolName(list, 'custom:9')).toBeUndefined();
  });
});

describe('hasFallback', () => {
  it('is a row of UnityYAMLMerge, the newest editor’s or one editor’s', () => {
    expect([hasFallback({ id: 'a', patterns: [], toolId: 'unityyamlmerge' }), hasFallback({ id: 'b', patterns: [], toolId: 'unityyamlmerge:2022.3.10f1' }), hasFallback({ id: 'c', patterns: [], toolId: 'meld' })]).toEqual([true, true, false]);
  });
});
