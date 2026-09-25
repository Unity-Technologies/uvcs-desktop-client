import { describe, expect, it } from 'vitest';
import { SEPARATOR, tidyMenu, withoutAction, type MenuEntry } from './actions';

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
