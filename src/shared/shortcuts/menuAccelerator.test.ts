import { describe, expect, it } from 'vitest';
import { keymapOf } from './keymap';
import { menuAccelerator, toAccelerator } from './menuAccelerator';

describe('menuAccelerator', () => {
  it("shows the command's shortcut on each OS", () => {
    expect(menuAccelerator(keymapOf({}, true), 'branch.new')).toBe('CmdOrCtrl+B');
    expect(menuAccelerator(keymapOf({}, true), 'branchExplorer.timeline')).toBe('CmdOrCtrl+Alt+T');
    expect(menuAccelerator(keymapOf({}, false), 'branchExplorer.timeline')).toBe('Alt+Shift+T');
  });

  it('shows the binding, not its alternatives', () => {
    expect(menuAccelerator(keymapOf({}, true), 'app.commandPalette')).toBe('CmdOrCtrl+K');
  });

  it('shows the key a person chose, and none for a shortcut they removed or a command with none', () => {
    expect(menuAccelerator(keymapOf({ newBranch: ['mod+shift+b'] }, true), 'branch.new')).toBe('CmdOrCtrl+Shift+B');
    expect(menuAccelerator(keymapOf({ newBranch: [] }, true), 'branch.new')).toBeUndefined();
    expect(menuAccelerator(keymapOf({}, true), 'merge.toBranch')).toBeUndefined();
  });
});

describe('toAccelerator', () => {
  it('names keys as Electron does', () => {
    expect(toAccelerator('mod+\\')).toBe('CmdOrCtrl+\\');
    expect(toAccelerator('ctrl+alt+shift+pagedown')).toBe('Ctrl+Alt+Shift+PageDown');
    expect(toAccelerator('mod+plus')).toBe('CmdOrCtrl+Plus');
    expect(toAccelerator('f7')).toBe('F7');
    expect(toAccelerator('alt+up')).toBe('Alt+Up');
  });
});
