import { describe, expect, it } from 'vitest';
import { isSubmenu, runningFirst, SEPARATOR, tidyMenu, withoutAction, type Action, type MenuEntry } from './actions';

const action = (id: string): MenuEntry => ({ id, label: id, run: () => {} });
const [diff, switchTo, copy] = [action('diff'), action('switch'), action('copy')];

describe('tidyMenu', () => {
  it('drops missing entries and the separators they leave at the edges or doubled', () => {
    expect(tidyMenu([SEPARATOR, switchTo, false, SEPARATOR, null, SEPARATOR, copy, SEPARATOR])).toEqual([switchTo, SEPARATOR, copy]);
  });
});

describe('withoutAction', () => {
  it('leaves out the action and the separator it no longer needs', () => {
    expect(withoutAction([diff, SEPARATOR, switchTo, SEPARATOR, copy], 'diff')).toEqual([switchTo, SEPARATOR, copy]);
  });

  it('keeps submenus, which have no id', () => {
    const submenu: MenuEntry = { label: 'Copy', entries: [diff] };
    expect(withoutAction([submenu], 'diff')).toEqual([submenu]);
  });
});

describe('runningFirst', () => {
  it('runs the hook before every action, in submenus too, but the kept ones', () => {
    const calls: string[] = [];
    const track = (id: string): Action => ({ id, label: id, run: () => calls.push(id) });
    const entries = runningFirst([track('switch'), SEPARATOR, { label: 'More', entries: [track('rename')] }, track('copy')], () => calls.push('close'), ['copy']);
    for (const entry of entries) {
      if (entry === SEPARATOR) continue;
      if (isSubmenu(entry)) (entry.entries[0] as Action).run();
      else entry.run();
    }
    expect(calls).toEqual(['close', 'switch', 'close', 'rename', 'copy']);
  });
});
