import { describe, expect, it } from 'vitest';
import { afterArrowClick, afterKey, afterTyping, COMBOBOX_CLOSED, comboboxListed, comboboxShown, type ComboboxKeyPress, type ComboboxState } from './comboboxState';

const options = ['default', 'game', 'acme/tools', 'game-server'];
const allOpen = (active: number): ComboboxState => ({ open: true, showAll: true, active });
const press = (key: string, more: Partial<ComboboxKeyPress> = {}): ComboboxKeyPress => ({ key, withShortcutModifier: false, composing: false, ...more });

describe('comboboxShown', () => {
  it('lists every option when the user asked for the list, whatever the field holds (a dropped folder)', () => {
    expect(comboboxShown(true, options, 'jump-game-folder')).toEqual(options);
  });

  it('lists the options matching what was typed, by words, in any case', () => {
    expect(comboboxShown(false, options, 'GAME')).toEqual(['game', 'game-server']);
    expect(comboboxShown(false, options, 'tools acme')).toEqual(['acme/tools']);
  });

  it('lists every option for an empty field, and none for a name nothing matches', () => {
    expect(comboboxShown(false, options, '  ')).toEqual(options);
    expect(comboboxShown(false, options, 'jump')).toEqual([]);
  });
});

describe('comboboxListed', () => {
  it('shows the list while open with something in it, in a field that can change', () => {
    expect(comboboxListed(allOpen(-1), 3, false)).toBe(true);
    expect(comboboxListed(COMBOBOX_CLOSED, 3, false)).toBe(false);
    expect(comboboxListed(allOpen(-1), 0, false)).toBe(false);
    expect(comboboxListed(allOpen(-1), 3, true)).toBe(false);
  });
});

describe('afterTyping', () => {
  it('opens the list on what was typed, with no row highlighted', () => {
    expect(afterTyping()).toEqual({ open: true, showAll: false, active: -1 });
  });
});

describe('afterArrowClick', () => {
  it('opens the full list on the option the field holds, spaces aside', () => {
    expect(afterArrowClick(false, options, ' game ')).toEqual(allOpen(1));
  });

  it('highlights none for a name not listed, by case too', () => {
    expect(afterArrowClick(false, options, 'Game')).toEqual(allOpen(-1));
  });

  it('closes the list on screen', () => {
    expect(afterArrowClick(true, options, 'game')).toEqual(COMBOBOX_CLOSED);
  });

  it("opens nothing while there are no options, so the list doesn't pop up later when they arrive", () => {
    expect(afterArrowClick(false, [], 'game')).toEqual(COMBOBOX_CLOSED);
  });
});

describe('afterKey', () => {
  describe('with the list closed', () => {
    it('opens the full list on ↓ or ↑, on the option the field holds', () => {
      expect(afterKey(COMBOBOX_CLOSED, press('ArrowDown'), options, 'game', false)).toEqual({ state: allOpen(1), handled: true });
      expect(afterKey(COMBOBOX_CLOSED, press('ArrowUp'), options, 'jump', false)).toEqual({ state: allOpen(-1), handled: true });
    });

    it("leaves ↓ alone while there are no options, so the list doesn't pop up later", () => {
      expect(afterKey(COMBOBOX_CLOSED, press('ArrowDown'), [], 'game', false)).toEqual({ state: COMBOBOX_CLOSED, handled: false });
    });

    it('leaves other keys to the field and the form: typed, or Enter submitting', () => {
      expect(afterKey(COMBOBOX_CLOSED, press('Enter'), options, 'game', false).handled).toBe(false);
      expect(afterKey(COMBOBOX_CLOSED, press('a'), options, 'game', false).handled).toBe(false);
    });

    it('treats an open list with nothing to show as closed', () => {
      expect(afterKey(afterTyping(), press('ArrowDown'), options, 'jump', false)).toEqual({ state: allOpen(-1), handled: true });
    });
  });

  describe('with the list on screen', () => {
    it('moves through the rows, from none highlighted to the first', () => {
      expect(afterKey(allOpen(-1), press('ArrowDown'), options, '', false)).toEqual({ state: allOpen(0), handled: true });
      expect(afterKey(allOpen(3), press('ArrowDown'), options, '', false)).toEqual({ state: allOpen(3), handled: true });
      expect(afterKey(allOpen(2), press('ArrowUp'), options, '', false)).toEqual({ state: allOpen(1), handled: true });
    });

    it('moves through the rows shown, not every option, after typing', () => {
      expect(afterKey(afterTyping(), press('PageDown'), options, 'game', false).state.active).toBe(1);
    });

    it('picks the row highlighted on Enter and closes', () => {
      expect(afterKey(allOpen(2), press('Enter'), options, 'jump', false)).toEqual({ state: COMBOBOX_CLOSED, handled: true, picked: 'acme/tools' });
    });

    it('lets Enter submit what was typed when no row is highlighted, so a new name stays as typed', () => {
      expect(afterKey(afterTyping(), press('Enter'), options, 'gam', false)).toEqual({ state: afterTyping(), handled: false });
    });

    it('lets Enter submit when the list shrank under the row highlighted', () => {
      expect(afterKey({ open: true, showAll: false, active: 3 }, press('Enter'), options, 'game', false).handled).toBe(false);
    });

    it('closes on Tab and lets it move on, and lets typing through', () => {
      expect(afterKey(allOpen(1), press('Tab'), options, '', false)).toEqual({ state: COMBOBOX_CLOSED, handled: false });
      expect(afterKey(allOpen(1), press('x'), options, '', false)).toEqual({ state: allOpen(1), handled: false });
    });
  });

  describe('keys that are not the combobox’s', () => {
    it('leaves shortcuts alone: Ctrl or ⌘ with Enter picks nothing', () => {
      expect(afterKey(allOpen(1), press('Enter', { withShortcutModifier: true }), options, '', false)).toEqual({ state: allOpen(1), handled: false });
    });

    it('leaves an input method its keys: the Enter that ends a composition picks nothing', () => {
      expect(afterKey(allOpen(1), press('Enter', { composing: true }), options, '', false)).toEqual({ state: allOpen(1), handled: false });
    });

    it('takes no key in a read-only field', () => {
      expect(afterKey(COMBOBOX_CLOSED, press('ArrowDown'), options, 'game', true)).toEqual({ state: COMBOBOX_CLOSED, handled: false });
    });
  });
});
