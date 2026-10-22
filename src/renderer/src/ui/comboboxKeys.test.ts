import { describe, expect, it } from 'vitest';
import { activeOnOpen, comboboxKeyAction, comboboxOptionsShown } from './comboboxKeys';

const options = ['default', 'game', 'acme/tools', 'game-server'];

describe('comboboxOptionsShown', () => {
  it('lists every option when the user asked for the list, whatever the field holds', () => {
    expect(comboboxOptionsShown(options, 'jump-game-folder', true)).toEqual(options);
  });

  it('lists the options matching what was typed, by words, in any case', () => {
    expect(comboboxOptionsShown(options, 'GAME', false)).toEqual(['game', 'game-server']);
    expect(comboboxOptionsShown(options, 'tools acme', false)).toEqual(['acme/tools']);
  });

  it('lists every option for an empty field, and none for a name nothing matches', () => {
    expect(comboboxOptionsShown(options, '  ', false)).toEqual(options);
    expect(comboboxOptionsShown(options, 'jump', false)).toEqual([]);
  });
});

describe('activeOnOpen', () => {
  it('highlights the option the field holds, spaces aside', () => {
    expect(activeOnOpen(options, ' game ')).toBe(1);
  });

  it('highlights none for a name not listed, by case too', () => {
    expect(activeOnOpen(options, 'Game')).toBe(-1);
    expect(activeOnOpen(options, '')).toBe(-1);
  });
});

describe('comboboxKeyAction', () => {
  describe('closed', () => {
    it('opens the full list on ↓ or ↑, on the option the field holds', () => {
      expect(comboboxKeyAction('ArrowDown', false, -1, options, 'game')).toEqual({ kind: 'open', active: 1 });
      expect(comboboxKeyAction('ArrowUp', false, -1, options, 'jump')).toEqual({ kind: 'open', active: -1 });
    });

    it('leaves other keys alone: typed, or Enter submitting the form', () => {
      expect(comboboxKeyAction('Enter', false, -1, options, 'game')).toEqual({ kind: 'none' });
      expect(comboboxKeyAction('a', false, -1, options, 'game')).toEqual({ kind: 'none' });
    });
  });

  describe('open', () => {
    it('moves through the rows, from none highlighted to the first', () => {
      expect(comboboxKeyAction('ArrowDown', true, -1, options, '')).toEqual({ kind: 'move', to: 0 });
      expect(comboboxKeyAction('ArrowDown', true, 3, options, '')).toEqual({ kind: 'move', to: 3 });
      expect(comboboxKeyAction('ArrowUp', true, 2, options, '')).toEqual({ kind: 'move', to: 1 });
    });

    it('picks the row highlighted on Enter', () => {
      expect(comboboxKeyAction('Enter', true, 2, options, '')).toEqual({ kind: 'pick', index: 2 });
    });

    it('lets Enter submit what was typed when no row is highlighted, so a new name stays as typed', () => {
      expect(comboboxKeyAction('Enter', true, -1, options, 'gam')).toEqual({ kind: 'none' });
      expect(comboboxKeyAction('Enter', true, 0, [], 'jump')).toEqual({ kind: 'none' });
    });

    it('closes on Tab, and lets typing through', () => {
      expect(comboboxKeyAction('Tab', true, 1, options, '')).toEqual({ kind: 'close' });
      expect(comboboxKeyAction('x', true, 1, options, '')).toEqual({ kind: 'none' });
    });

    it('moves nowhere in an empty list', () => {
      expect(comboboxKeyAction('ArrowDown', true, -1, [], 'jump')).toEqual({ kind: 'none' });
    });
  });
});
