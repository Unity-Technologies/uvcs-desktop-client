import { describe, expect, it } from 'vitest';
import { SEPARATOR, type MenuEntry } from './actions';
import { groupedMenu } from './menuGroups';

const action = (id: string): MenuEntry => ({ id, label: id, run: () => {} });
const [diff, switchTo, merge, copy, rename, remove] = ['diff', 'switch', 'merge', 'copy', 'rename', 'delete'].map(action) as MenuEntry[];

describe('groupedMenu', () => {
  it('puts the groups in the canonical order, whatever order they are given in, with a separator between them', () => {
    expect(groupedMenu({ danger: [remove], copy: [copy], primary: [diff], act: [switchTo, merge] })).toEqual([
      diff,
      SEPARATOR,
      switchTo,
      merge,
      SEPARATOR,
      copy,
      SEPARATOR,
      remove,
    ]);
  });

  it('skips groups left empty by entries that do not apply', () => {
    expect(groupedMenu({ primary: [false], act: [null, switchTo], edit: [undefined], danger: [remove] })).toEqual([switchTo, SEPARATOR, remove]);
  });

  it('keeps the separators a long group splits itself with', () => {
    expect(groupedMenu({ act: [switchTo, SEPARATOR, merge], edit: [rename] })).toEqual([switchTo, SEPARATOR, merge, SEPARATOR, rename]);
  });
});
