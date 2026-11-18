import { describe, expect, it } from 'vitest';
import { showsFocusRing } from '../../lib/focusRing';
import { mainFocusMover, ringsAtKey } from './mainFocusMover';

const key = (name: string, chord: Partial<Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey'>> = {}) => ({ key: name, metaKey: false, ctrlKey: false, altKey: false, ...chord });

describe('mainFocusMover', () => {
  it('gives the first list focus without a ring when a workspace or repository opens: no one moved it, so its selected row shows no keyboard ring', () => {
    expect(showsFocusRing(mainFocusMover('placeOpened'))).toBe(false);
  });

  it('leaves the ring to how the user navigated (⌘1… rings, a sidebar click does not)', () => {
    expect(mainFocusMover('navigated')).toBe('keyboard');
  });
});

describe('ringsAtKey', () => {
  it('rings the list the app focused at the first key aimed at it, as a list reached by a click rings at its first key', () => {
    expect(ringsAtKey(key('ArrowDown'), { ringless: true, onMainList: true })).toBe(true);
    expect(ringsAtKey(key('j'), { ringless: true, onMainList: true })).toBe(true);
  });

  it('leaves a list that already shows the keyboard ring, or never was ringless, as it is', () => {
    expect(ringsAtKey(key('ArrowDown'), { ringless: false, onMainList: true })).toBe(false);
  });

  it('leaves focus that moved elsewhere (a field, a button) as it is', () => {
    expect(ringsAtKey(key('ArrowDown'), { ringless: true, onMainList: false })).toBe(false);
  });

  it('ignores keys not aimed at the list: chords (a shortcut) and modifiers alone', () => {
    expect(ringsAtKey(key('ArrowDown', { metaKey: true }), { ringless: true, onMainList: true })).toBe(false);
    expect(ringsAtKey(key('Shift'), { ringless: true, onMainList: true })).toBe(false);
  });
});
