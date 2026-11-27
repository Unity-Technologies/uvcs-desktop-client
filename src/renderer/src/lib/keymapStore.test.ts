import '../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import { setCustomShortcuts, useKeymapStore } from './keymapStore';
import { hotkey, hotkeys } from './shortcutRegistry';

afterEach(() => setCustomShortcuts({}));

describe('keymapStore', () => {
  it("gives hotkey() the keys a person chose, and the registry's again once they're reset", () => {
    expect(hotkey('newBranch')).toBe('mod+b');
    setCustomShortcuts({ newBranch: ['mod+shift+b'], commandLog: [] });
    expect(hotkey('newBranch')).toBe('mod+shift+b');
    expect(hotkey('commandLog')).toBeUndefined();
    expect(hotkeys('commandLog')).toEqual([]);
    setCustomShortcuts({});
    expect(hotkey('newBranch')).toBe('mod+b');
  });

  it('keeps its keymap while the custom shortcuts stay the same, so the window renders again only for a change', () => {
    setCustomShortcuts({ newBranch: ['mod+shift+b'] });
    const keymap = useKeymapStore.getState().keymap;
    setCustomShortcuts({ newBranch: ['mod+shift+b'] });
    expect(useKeymapStore.getState().keymap).toBe(keymap);
  });
});
