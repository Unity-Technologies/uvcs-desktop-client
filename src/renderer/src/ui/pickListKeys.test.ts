import { describe, expect, it } from 'vitest';
import { pickListKeyAction } from './pickListKeys';

describe('pickListKeyAction', () => {
  it('moves through the rows with the arrows and a page at a time, staying within them', () => {
    expect(pickListKeyAction('ArrowDown', 0, 3)).toEqual({ kind: 'move', to: 1 });
    expect(pickListKeyAction('ArrowDown', 2, 3)).toEqual({ kind: 'move', to: 2 });
    expect(pickListKeyAction('ArrowUp', 0, 3)).toEqual({ kind: 'move', to: 0 });
    expect(pickListKeyAction('PageDown', 0, 30)).toEqual({ kind: 'move', to: 10 });
  });

  it('picks the row the arrows are on with Enter, within the rows the search leaves', () => {
    expect(pickListKeyAction('Enter', 1, 3)).toEqual({ kind: 'pick', index: 1 });
    expect(pickListKeyAction('Enter', 7, 3)).toEqual({ kind: 'pick', index: 2 });
  });

  it('types everything else, and every key with no rows', () => {
    expect(pickListKeyAction('a', 0, 3)).toEqual({ kind: 'type' });
    expect(pickListKeyAction(' ', 0, 3)).toEqual({ kind: 'type' });
    expect(pickListKeyAction('Enter', 0, 0)).toEqual({ kind: 'type' });
  });
});
