import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type * as Registry from './shortcutRegistry';

let SHORTCUT_AREAS: typeof Registry.SHORTCUT_AREAS;
let SHORTCUTS: typeof Registry.SHORTCUTS;
let shortcutKeys: typeof Registry.shortcutKeys;
let viewShortcut: typeof Registry.viewShortcut;

beforeAll(async () => {
  vi.stubGlobal('window', { uvcs: { platform: 'darwin' } });
  ({ SHORTCUT_AREAS, SHORTCUTS, shortcutKeys, viewShortcut } = await import('./shortcutRegistry'));
});

const RENDERER = join(__dirname, '..');
const APP_MENU = join(RENDERER, '..', '..', 'main', 'window', 'appMenuTemplate.ts');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Shortcuts written as literals: a modifier chord anywhere, or any key given to a shortcut prop, field or hook. */
const LITERAL_SHORTCUT = [
  /['"`](?:mod|alt|shift|ctrl)\+[^'"`\s]*['"`]/,
  /\bshortcut:\s*['"`]/,
  /\b(?:shortcut|keys|data-tip-shortcut)=(?:["']|\{\s*['"`])/,
  /\buseShortcut\(\s*['"`]/,
];

const everyKey = () => Object.values(SHORTCUTS).flatMap((shortcut) => [...shortcut.keys, ...('keysOffMac' in shortcut ? shortcut.keysOffMac : [])]);
const keysOn = (mac: boolean) => Object.values(SHORTCUTS).flatMap((shortcut) => shortcutKeys(shortcut, mac));

describe('shortcut registry', () => {
  it('holds every shortcut of the renderer: bindings, tooltips and key caps read their keys from it', () => {
    const offenders = sourceFiles(RENDERER)
      .filter((path) => !path.endsWith('shortcutRegistry.ts'))
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split('\n')
          .map((line, index) => ({ line, where: `${relative(RENDERER, path)}:${index + 1}` }))
          .filter(({ line }) => !/^\s*(\*|\/\/|\/\*)/.test(line) && LITERAL_SHORTCUT.some((pattern) => pattern.test(line)))
          .map(({ line, where }) => `${where}: ${line.trim()}`),
      );
    expect(offenders).toEqual([]);
  });

  it('shows the native menu accelerators of the keys the renderer binds', () => {
    const items = [...readFileSync(APP_MENU, 'utf8').matchAll(/commandItem\('[^']+', '([^']+)', '([^']+)'[,)]/g)];
    expect(items.length).toBeGreaterThan(0);
    for (const [, commandId, accelerator] of items) {
      const shortcut = Object.values(SHORTCUTS).find((candidate) => 'commandId' in candidate && candidate.commandId === commandId);
      expect(shortcut, commandId).toBeDefined();
      for (const mac of [true, false]) expect(toAccelerator(shortcutKeys(shortcut!, mac)[0]!), commandId).toBe(accelerator);
    }
  });

  it('puts every shortcut in a known area', () => {
    for (const shortcut of Object.values(SHORTCUTS)) expect(SHORTCUT_AREAS).toContain(shortcut.area);
  });

  it('gives global shortcuts and views distinct keys', () => {
    for (const mac of [true, false]) {
      const global = Object.values(SHORTCUTS)
        .filter((shortcut) => shortcut.area === 'General' && !shortcut.label.startsWith('Save'))
        .flatMap((shortcut) => shortcutKeys(shortcut, mac));
      const views = Array.from({ length: 14 }, (_, position) => viewShortcut(position, mac));
      const keys = [...global, ...views];
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('writes keys the formatter and matcher understand', () => {
    for (const key of everyKey()) expect(key).toMatch(/^((mod|ctrl|alt|shift)\+)*([a-z0-9]|f\d+|[-=,/[\]?\\]|plus|space|enter|escape|tab|backspace|delete|up|down|left|right|home|end|pageup|pagedown)$/);
  });

  it('keeps Ctrl+Alt free off macOS, where it is AltGr and types characters', () => {
    const views = Array.from({ length: 14 }, (_, position) => viewShortcut(position, false));
    for (const key of [...keysOn(false), ...views]) expect(key, key).not.toMatch(/(mod|ctrl)\+(shift\+)?alt\+|alt\+(shift\+)?(mod|ctrl)\+/);
  });

  it('leaves Windows and Linux desktops their own keys', () => {
    const reserved = ['alt+f4', 'alt+tab', 'alt+space', 'alt+escape', 'mod+escape', 'mod+shift+escape', 'alt+shift', 'f1'];
    for (const key of keysOn(false)) expect(reserved, key).not.toContain(key);
  });

  it('takes Windows and Linux conventions where they differ from the Mac', () => {
    expect(shortcutKeys(SHORTCUTS.back, false)).toEqual(['alt+left']);
    expect(shortcutKeys(SHORTCUTS.deleteFile, false)).toEqual(['delete']);
    expect(shortcutKeys(SHORTCUTS.deleteFile, true)).toEqual(['mod+backspace']);
    expect(shortcutKeys(SHORTCUTS.discardLines, true)).toEqual(['mod+alt+z']);
  });

  it('opens the menu with F10 off macOS only, where the window has no menu bar of its own on Windows', () => {
    expect(shortcutKeys(SHORTCUTS.appMenu, false)).toEqual(['f10']);
    expect(shortcutKeys(SHORTCUTS.appMenu, true)).toEqual([]);
  });
});

describe('viewShortcut', () => {
  const first = ['mod+1', 'mod+2', 'mod+3', 'mod+4', 'mod+5', 'mod+6', 'mod+7', 'mod+8', 'mod+9'];

  it('numbers the views in sidebar order, then with Option on macOS, leaving ⌘0 to Actual Size', () => {
    expect(Array.from({ length: 12 }, (_, position) => viewShortcut(position, true))).toEqual([...first, 'mod+alt+1', 'mod+alt+2', 'mod+alt+3']);
  });

  it('never gives a view the chords macOS keeps for screenshots (⇧⌘3, ⇧⌘4, ⇧⌘5)', () => {
    const views = Array.from({ length: 14 }, (_, position) => viewShortcut(position, true));
    for (const screenshot of ['mod+shift+3', 'mod+shift+4', 'mod+shift+5']) expect(views).not.toContain(screenshot);
  });

  it('goes on with Shift elsewhere, where Ctrl+Alt is AltGr', () => {
    expect(Array.from({ length: 12 }, (_, position) => viewShortcut(position, false))).toEqual([...first, 'mod+shift+1', 'mod+shift+2', 'mod+shift+3']);
  });
});

function toAccelerator(shortcut: string): string {
  const names: Record<string, string> = { mod: 'CmdOrCtrl', shift: 'Shift', alt: 'Alt', ctrl: 'Ctrl' };
  return shortcut
    .split('+')
    .map((key) => names[key] ?? key.toUpperCase())
    .join('+');
}
