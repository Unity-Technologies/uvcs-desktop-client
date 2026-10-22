import { describe, expect, it } from 'vitest';
import type { MergeToolRule } from '@shared/domain/mergeTools';
import { SEPARATOR, type Action } from '../../lib/actions';
import { addRule, AUTOMATIC_MERGE_TOOL_CHOICE, changedPatterns, changeRule, howItOpensEntries, moveRule, newRuleToolId, removeRule, ruleMenuEntries, ruleName, SAME_AS_OTHER_FILES_CHOICE, toolInUse, unityRowNote, unityRowTip } from './mergeToolRules';
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

describe('the Unity row', () => {
  it('says Smart Merge goes first, from which Unity Editor, or that none was found', () => {
    const smartMerge = { executable: '/u/UnityYAMLMerge', editorVersion: '6000.5.0f1' };
    expect(unityRowNote(smartMerge)).toBe('Smart Merge first');
    expect(unityRowTip(smartMerge)).toBe('Smart Merge (Unity 6000.5.0f1) merges them by their objects, without opening anything. The tool opens only what it can’t merge.');
    expect(unityRowTip({ ...smartMerge, editorVersion: '' })).toContain('Smart Merge (Unity) merges');
    expect(unityRowNote(null)).toBe('No Unity Editor for Smart Merge');
    expect(unityRowTip(null)).toBe('Smart Merge, in every Unity Editor, merges them by their objects. The tool opens only what it can’t merge.');
  });
});

describe('toolInUse', () => {
  const tool = (id: string): MergeTool => ({ id, name: id, origin: 'known', executable: id, args: [], defaultArgs: [], canBringToFront: false });
  const list: MergeToolList = { tools: [tool('uvcs'), tool('meld')], preferredId: 'uvcs', knownNames: {}, smartMerge: null };

  it('is the tool picked, or every other file’s for a choice that picks for the user', () => {
    expect(toolInUse(list, 'meld', null)?.id).toBe('meld');
    expect(toolInUse(list, 'auto', AUTOMATIC_MERGE_TOOL_CHOICE)?.id).toBe('uvcs');
    expect(toolInUse(list, 'others', SAME_AS_OTHER_FILES_CHOICE)?.id).toBe('uvcs');
  });

  it('is none while the tool a row picked isn’t found here', () => {
    expect(toolInUse(list, 'semantic', null)).toBeUndefined();
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
