import { describe, expect, it } from 'vitest';
import { SEPARATOR } from './actions';
import { groupedMenu, withEntries, type GroupedEntry, type MenuGroup } from './menuGroups';

const action = (id: string, group: MenuGroup): GroupedEntry => ({ id, label: id, menuGroup: group, run: () => {} });
const diff = action('diff', 'primary');
const switchTo = action('switch', 'act');
const merge = action('merge', 'merge');
const copy = action('copy', 'clipboard');
const rename = action('rename', 'edit');
const remove = action('delete', 'danger');

describe('groupedMenu', () => {
  it('puts the groups in the canonical order, whatever order the entries come in, with a separator between them', () => {
    expect(groupedMenu([remove, copy, diff, merge, switchTo])).toEqual([diff, SEPARATOR, switchTo, SEPARATOR, merge, SEPARATOR, copy, SEPARATOR, remove]);
  });

  it('skips entries that do not apply, and the groups they leave empty', () => {
    expect(groupedMenu([false, null, switchTo, undefined, remove])).toEqual([switchTo, SEPARATOR, remove]);
  });

  it('keeps the order within a group, so what a context adds comes after the common entries', () => {
    const goToHead = action('head', 'navigate');
    const showInGraph = action('showInBranchExplorer', 'navigate');
    expect(groupedMenu([showInGraph, rename, goToHead])).toEqual([showInGraph, goToHead, SEPARATOR, rename]);
  });

  it('adds what a place adds at the end of its group, leaving the common entries as they were', () => {
    const goToHead = action('head', 'navigate');
    const showInGraph = action('showInBranchExplorer', 'navigate');
    expect(withEntries(groupedMenu([diff, showInGraph, remove]), [goToHead, false])).toEqual([diff, SEPARATOR, showInGraph, goToHead, SEPARATOR, remove]);
  });
});
