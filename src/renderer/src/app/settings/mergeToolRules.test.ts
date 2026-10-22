import { describe, expect, it } from 'vitest';
import type { MergeToolRule } from '@shared/domain/mergeTools';
import { SEPARATOR, type Action, type MenuEntry } from '../../lib/actions';
import { moveRule, removeRule, rowMenuEntries } from './mergeToolRules';

const rule = (id: string): MergeToolRule => ({ id, patterns: [`.${id}`], toolId: 'uvcs' });
const rules = [rule('a'), rule('b'), rule('c')];
const ids = (list: MergeToolRule[]): string[] => list.map((each) => each.id);
const reading = (menu: MenuEntry[]): string[] => menu.map((entry) => (entry === SEPARATOR ? '---' : `${(entry as Action).label}${(entry as Action).disabled ? ' (disabled)' : ''}`));

describe('the rules of Settings › Merge', () => {
  it('moves a row one place, never past the ends', () => {
    expect(ids(moveRule(rules, 'b', -1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveRule(rules, 'b', 1))).toEqual(['a', 'c', 'b']);
    expect(ids(moveRule(rules, 'a', -1))).toEqual(['a', 'b', 'c']);
    expect(ids(moveRule(rules, 'c', 1))).toEqual(['a', 'b', 'c']);
  });

  it('removes a row', () => {
    expect(ids(removeRule(rules, 'b'))).toEqual(['a', 'c']);
  });
});

describe('rowMenuEntries', () => {
  it('edits a rule, moves it where it can go, and removes it', () => {
    const saved: string[][] = [];
    const edited: string[] = [];
    const menu = (id: string) => rowMenuEntries(rules, id, () => edited.push(id), (changed) => saved.push(ids(changed)));

    expect(reading(menu('a'))).toEqual(['Edit…', '---', 'Move up (disabled)', 'Move down', '---', 'Remove']);
    expect(reading(menu('c'))).toEqual(['Edit…', '---', 'Move up', 'Move down (disabled)', '---', 'Remove']);
    (menu('b')[0] as Action).run();
    (menu('b')[2] as Action).run();
    (menu('b')[5] as Action).run();
    expect(edited).toEqual(['b']);
    expect(saved).toEqual([
      ['b', 'a', 'c'],
      ['a', 'c'],
    ]);
  });

  it('only edits every other file’s row, which stays last', () => {
    expect(reading(rowMenuEntries(rules, null, () => {}, () => {}))).toEqual(['Edit…']);
  });
});
