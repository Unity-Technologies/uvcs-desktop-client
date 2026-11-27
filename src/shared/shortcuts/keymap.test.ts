import { describe, expect, it } from 'vitest';
import { canonicalKey, clash, defaultKeysTakenFrom, keyChoice, keymapOf, withDefaultKeys, withShortcutKey, type CustomShortcuts } from './keymap';
import { SHORTCUTS, shortcutKeys, type ShortcutId } from './shortcutRegistry';

const MAC = true;
const OFF_MAC = false;

describe('keymapOf', () => {
  it("gives every shortcut the registry's keys while a person changed none", () => {
    for (const mac of [MAC, OFF_MAC]) {
      const keymap = keymapOf({}, mac);
      for (const id of Object.keys(SHORTCUTS) as ShortcutId[]) expect(keymap[id], id).toEqual(shortcutKeys(SHORTCUTS[id], mac));
    }
  });

  it('gives a changed shortcut the keys a person chose, or none', () => {
    const keymap = keymapOf({ newBranch: ['mod+shift+b'], commandLog: [] }, MAC);
    expect(keymap.newBranch).toEqual(['mod+shift+b']);
    expect(keymap.commandLog).toEqual([]);
  });

  it("keeps the registry's keys of a shortcut that can't change, whatever the settings say", () => {
    expect(keymapOf({ textCopy: ['mod+shift+b'] }, MAC).textCopy).toEqual(['mod+c']);
  });

  it("keeps the registry's keys where the keys kept can't run it any more, and ignores shortcuts that are gone", () => {
    // A later version may reserve a key, or drop a shortcut: the settings still hold what was chosen then.
    const keymap = keymapOf({ newBranch: ['mod+q'], someShortcutRemoved: ['mod+shift+b'] }, MAC);
    expect(keymap.newBranch).toEqual(['mod+b']);
    expect(Object.keys(keymap)).not.toContain('someShortcutRemoved');
  });

  it('leaves a key a person chose to them when the app gives it to another shortcut later', () => {
    // As if ⇧⌘B were a later default of Settings, which shares General with New branch.
    const keymap = keymapOf({ newBranch: [SHORTCUTS.settings.keys[0]] }, MAC);
    expect(keymap.newBranch).toEqual(['mod+,']);
    expect(keymap.settings).toEqual([]);
  });

  it("drops a person's key that a shortcut that can't change takes in a later version, giving theirs back the app's keys", () => {
    // As if ⌘C, Copy in the text, were a key a person once gave Edit the file: Copy keeps it.
    const keymap = keymapOf({ editFile: ['mod+c'] }, MAC);
    expect(keymap.editFile).toEqual(['mod+e']);
    expect(keymap.textCopy).toEqual(['mod+c']);
  });

  it('lets shortcuts of views of their own share a key', () => {
    // ⇧⌘T diffs or annotates a revision in History; Files is a view of its own.
    const keymap = keymapOf({ fileHistory: ['mod+shift+t'] }, MAC);
    expect(keymap.fileHistory).toEqual(['mod+shift+t']);
    expect(keymap.historyToggleView).toEqual(['mod+shift+t']);
  });

  it('reads keys written with their modifiers in any order', () => {
    expect(keymapOf({ newBranch: ['shift+mod+b'] }, MAC).newBranch).toEqual(['mod+shift+b']);
  });
});

describe('clash', () => {
  it('pairs shortcuts of the whole window with any other, and shortcuts of one area together', () => {
    expect(clash('newBranch', 'graphMerge')).toBe(true);
    expect(clash('nextChange', 'discardLines')).toBe(true);
    expect(clash('graphMerge', 'fileHistory')).toBe(false);
  });

  it('pairs the areas a screen shows together: a view, its list, its diff and the diff\'s text', () => {
    // Changes shows a diff beside its list; Files lists its items and shows changes with the list's key.
    expect(clash('myShelves', 'editFile')).toBe(true);
    expect(clash('newFile', 'listDiff')).toBe(true);
    expect(clash('editFile', 'textCopy')).toBe(true);
    expect(clash('historyToggleView', 'annotateNextBlock')).toBe(true);
    expect(clash('graphMerge', 'nextConflict')).toBe(false);
  });

  it("keeps a comment field's keys apart from the window's, and General's keys that act where they're used", () => {
    expect(clash('commentBold', 'newBranch')).toBe(false);
    expect(clash('saveComment', 'checkin')).toBe(false);
  });
});

describe('keyChoice', () => {
  const keymap = keymapOf({}, MAC);

  it('allows a free key', () => {
    expect(keyChoice('newBranch', 'mod+shift+b', keymap, MAC)).toEqual({ kind: 'allowed', takenFrom: [], elsewhere: [] });
  });

  it('says a shortcut already has the key pressed, its binding or another', () => {
    expect(keyChoice('newBranch', 'mod+b', keymap, MAC)).toEqual({ kind: 'unchanged' });
    expect(keyChoice('commandPalette', 'mod+k', keymap, MAC)).toEqual({ kind: 'unchanged' });
    expect(keyChoice('commandPalette', 'mod+shift+p', keymap, MAC)).toEqual({ kind: 'unchanged' });
  });

  it('asks before taking a key from a shortcut of an area shown on the same screen, and refuses one that can\'t change', () => {
    expect(keyChoice('myShelves', 'mod+e', keymap, MAC)).toEqual({ kind: 'allowed', takenFrom: ['editFile'], elsewhere: ['historyEnterPane'] });
    expect(keyChoice('newFile', 'mod+d', keymap, MAC)).toMatchObject({ kind: 'allowed', takenFrom: ['listDiff'] });
    expect(keyChoice('editFile', 'mod+c', keymap, MAC)).toMatchObject({ kind: 'refused' });
  });

  it('takes a key from the shortcuts it clashes with that can change, and names those elsewhere that keep it', () => {
    expect(keyChoice('newBranch', 'mod+shift+w', keymap, MAC)).toEqual({ kind: 'allowed', takenFrom: ['switchBranch'], elsewhere: [] });
    expect(keyChoice('graphMerge', 'mod+shift+t', keymap, MAC)).toEqual({ kind: 'allowed', takenFrom: [], elsewhere: ['historyToggleView'] });
  });

  it("refuses a key a shortcut that can't change takes", () => {
    expect(keyChoice('newBranch', 'mod+shift+z', keymap, MAC)).toEqual({ kind: 'refused', reason: "Redo (Text) takes it, and can't change." });
  });

  it('refuses the keys the OS, the menus and the views take', () => {
    expect(keyChoice('newBranch', 'mod+q', keymap, MAC)).toEqual({ kind: 'refused', reason: 'Quits the app.' });
    expect(keyChoice('newBranch', 'alt+f4', keymapOf({}, OFF_MAC), OFF_MAC)).toEqual({ kind: 'refused', reason: 'Closes the window.' });
    expect(keyChoice('newBranch', 'mod+2', keymap, MAC)).toEqual({ kind: 'refused', reason: 'Goes to a view of the sidebar.' });
    expect(keyChoice('newBranch', 'mod+plus', keymap, MAC)).toEqual({ kind: 'refused', reason: 'Zooms in.' });
  });

  it('refuses Ctrl+Alt off macOS, where it is AltGr, and allows ⌘⌥ on macOS', () => {
    expect(keyChoice('newBranch', 'mod+alt+b', keymapOf({}, OFF_MAC), OFF_MAC)).toEqual({ kind: 'refused', reason: 'Ctrl+Alt types characters on many keyboards.' });
    expect(keyChoice('newBranch', 'mod+alt+b', keymap, MAC).kind).toBe('allowed');
  });

  it("gives a key that would type a modifier, unless the shortcut's own keys need none", () => {
    expect(keyChoice('newBranch', 'b', keymap, MAC)).toEqual({ kind: 'refused', reason: "Needs ⌘, ⌃ or ⌥, or a function key, so it doesn't type." });
    expect(keyChoice('newBranch', 'shift+b', keymapOf({}, OFF_MAC), OFF_MAC)).toEqual({ kind: 'refused', reason: "Needs Ctrl or Alt, or a function key, so it doesn't type." });
    expect(keyChoice('newBranch', 'f8', keymap, MAC).kind).toBe('allowed');
    expect(keyChoice('nextComment', 'b', keymap, MAC).kind).toBe('allowed');
  });

  it('refuses a plain key for a shortcut whose only plain key is a function key, as it runs while typing', () => {
    expect(keyChoice('nextChange', 'j', keymap, MAC)).toMatchObject({ kind: 'refused' });
    expect(keyChoice('nextChange', 'f8', keymap, MAC).kind).toBe('allowed');
  });

  it('refuses ⌥ with a letter, a digit or a symbol alone on macOS, which types a character there', () => {
    expect(keyChoice('newBranch', 'alt+l', keymap, MAC)).toEqual({ kind: 'refused', reason: '⌥ with a letter, digit or symbol types a character.' });
    expect(keyChoice('newBranch', 'alt+shift+5', keymap, MAC).kind).toBe('refused');
    expect(keyChoice('newBranch', 'mod+alt+l', keymap, MAC).kind).toBe('allowed');
    expect(keyChoice('nextChangeset', 'alt+pagedown', keymap, MAC).kind).toBe('allowed');
  });
});

describe('withShortcutKey', () => {
  it("keeps only the shortcuts whose keys differ from the registry's", () => {
    const keymap = keymapOf({}, MAC);
    const custom = withShortcutKey({}, keymap, 'newBranch', 'mod+shift+b', MAC);
    expect(custom).toEqual({ newBranch: ['mod+shift+b'] });
    expect(withShortcutKey(custom, keymapOf(custom, MAC), 'newBranch', 'mod+b', MAC)).toEqual({});
  });

  it('takes the key from the shortcut it clashes with, which keeps its other keys', () => {
    const keymap = keymapOf({}, MAC);
    expect(withShortcutKey({}, keymap, 'newBranch', 'mod+shift+w', MAC)).toEqual({ newBranch: ['mod+shift+w'], switchBranch: [] });
    expect(withShortcutKey({}, keymap, 'newBranch', 'mod+shift+p', MAC)).toEqual({ newBranch: ['mod+shift+p'], commandPalette: ['mod+k'] });
  });

  it('removes the shortcut', () => {
    expect(withShortcutKey({}, keymapOf({}, MAC), 'commandLog', null, MAC)).toEqual({ commandLog: [] });
  });
});

describe('withDefaultKeys', () => {
  it("gives a shortcut the registry's keys again", () => {
    const custom: CustomShortcuts = { newBranch: ['mod+shift+b'], commandLog: [] };
    expect(defaultKeysTakenFrom('newBranch', keymapOf(custom, MAC), MAC)).toEqual([]);
    expect(withDefaultKeys(custom, keymapOf(custom, MAC), 'newBranch', MAC)).toEqual({ commandLog: [] });
  });

  it('takes its keys back from the shortcut a person gave them to since, which says so first', () => {
    // New branch took ⇧⌘W from Switch branch; giving Switch branch its keys back takes ⇧⌘W from New branch.
    const custom: CustomShortcuts = { newBranch: ['mod+shift+w'], switchBranch: [] };
    const keymap = keymapOf(custom, MAC);
    expect(defaultKeysTakenFrom('switchBranch', keymap, MAC)).toEqual(['newBranch']);
    expect(withDefaultKeys(custom, keymap, 'switchBranch', MAC)).toEqual({ newBranch: [] });
  });
});

describe('canonicalKey', () => {
  it('orders the modifiers as the registry writes them', () => {
    expect(canonicalKey('shift+alt+ctrl+mod+k')).toBe('mod+ctrl+alt+shift+k');
    expect(canonicalKey('escape')).toBe('escape');
  });
});
