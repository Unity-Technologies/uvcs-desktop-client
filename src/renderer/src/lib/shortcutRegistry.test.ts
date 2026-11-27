/// <reference types="node" />
import '../testing/fakeWindow';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';
import { SHORTCUT_AREAS, SHORTCUTS, shortcutKeys, viewShortcut, type ShortcutDefinition } from '@shared/shortcuts/shortcutRegistry';

const RENDERER = join(__dirname, '..');

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
    const offenders = filesUnder(RENDERER, isAppSource)
      .filter((path) => !path.endsWith('shortcutRegistry.ts'))
      .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
      // Most files name no shortcut at all: matched whole first, so only the few that do are read line by line.
      .filter(({ text }) => LITERAL_SHORTCUT.some((pattern) => pattern.test(text)))
      .flatMap(({ path, text }) =>
        text
          .split('\n')
          .map((line, index) => ({ line, where: `${relative(RENDERER, path)}:${index + 1}` }))
          .filter(({ line }) => !/^\s*(\*|\/\/|\/\*)/.test(line) && LITERAL_SHORTCUT.some((pattern) => pattern.test(line)))
          .map(({ line, where }) => `${where}: ${line.trim()}`),
      );
    expect(offenders).toEqual([]);
  });

  it('reads the keys of a shortcut a person may change again in every memo, when the keymap changes', () => {
    // A memo that keeps `hotkey('newBranch')` keeps the old key after a change unless it depends on `useKeymap()`.
    const customizable = Object.entries(SHORTCUTS).filter(([, shortcut]) => (shortcut as ShortcutDefinition).customizable).map(([id]) => id);
    const offenders = filesUnder(RENDERER, isAppSource)
      .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
      .filter(({ text }) => /\buse(Memo|Callback)\b/.test(text) && /\bhotkeys?\(/.test(text))
      .flatMap(({ path, text }) =>
        memosIn(text)
          .filter(({ body, deps }) => readsKeysOf(body, customizable) && !/\bkeymap\b/.test(deps))
          .map(({ line }) => `${relative(RENDERER, path)}:${line}`),
      );
    expect(offenders).toEqual([]);
  });

  it('never keeps the keys of a shortcut a person may change in a constant read once, as its module loads', () => {
    const customizable = Object.entries(SHORTCUTS).filter(([, shortcut]) => (shortcut as ShortcutDefinition).customizable).map(([id]) => id);
    const offenders = filesUnder(RENDERER, isAppSource)
      .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
      .filter(({ text }) => /\bhotkeys?\(/.test(text))
      .flatMap(({ path, text }) =>
        moduleConstants(text)
          .filter(({ initializer }) => readsKeysOf(initializer, customizable))
          .map(({ line }) => `${relative(RENDERER, path)}:${line}`),
      );
    expect(offenders).toEqual([]);
  });

  it('says of every shortcut whether a person may change it, or why not, so Settings › Keyboard lists them all', () => {
    const undecided = Object.entries(SHORTCUTS)
      .filter(([, shortcut]) => ('customizable' in shortcut) === ('fixed' in shortcut))
      .map(([id]) => id);
    expect(undecided).toEqual([]);
  });

  it('never compares a key by hand, which a person changing it in Settings › Keyboard would never reach', () => {
    // A key compared as `event.key === 'r'` keeps running on R after a person gives the shortcut another key: every
    // key is matched through the registry (`hotkeys`, `matchesShortcut`). The lines left are Select all in a list or a
    // table, and Copy with text selected, which every app shares (`fixed: 'shared'`).
    const allowed = [
      "} else if (event.key === 'a' && isModPressed(event)) {",
      "return selectedText !== '' && isModPressed(event, mac) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'c';",
    ];
    const offenders = filesUnder(RENDERER, isAppSource).flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .map((line, index) => ({ line: line.trim(), where: `${relative(RENDERER, path)}:${index + 1}` }))
        .filter(({ line }) => /\.key(?:\.toLowerCase\(\))? === '[a-zA-Z0-9]'/.test(line) && !allowed.includes(line))
        .map(({ where, line }) => `${where}: ${line}`),
    );
    expect(offenders).toEqual([]);
  });

  it('binds every shortcut a person may change through the registry, by its id, so a change reaches it', () => {
    // A key matched by hand, or from a table of letters, would show the new key in Settings › Keyboard and still run
    // on the old one. The forms that bind by id: `hotkey('id')`, `hotkeys('id')`, `matchesAny(event, 'id')`,
    // `shortcutId: 'id'`, a step's `{ next: 'id', previous: 'id' }` (`StepShortcuts`), and tables of `['id', action]`.
    const sources = filesUnder(RENDERER, isAppSource).map((path) => readFileSync(path, 'utf8')).join('\n');
    const unbound = Object.entries(SHORTCUTS)
      .filter(([, shortcut]) => (shortcut as ShortcutDefinition).customizable)
      .map(([id]) => id)
      .filter((id) => !new RegExp(`(?:hotkeys?\\(|matchesAny\\([^,]+, |shortcutId: |(?:next|previous): |\\[\\s*)'${id}'`).test(sources));
    expect(unbound).toEqual([]);
  });

  it('puts every shortcut in a known area', () => {
    for (const shortcut of Object.values(SHORTCUTS)) expect(SHORTCUT_AREAS).toContain(shortcut.area);
  });

  it('gives global shortcuts and views distinct keys', () => {
    for (const mac of [true, false]) {
      const global = Object.values(SHORTCUTS)
        .filter((shortcut) => shortcut.area === 'General')
        .flatMap((shortcut) => shortcutKeys(shortcut, mac));
      const views = Array.from({ length: 14 }, (_, position) => viewShortcut(position, mac));
      const keys = [...global, ...views];
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("lets only a comment field's keys share a global key, inside the field (`scope`), and gives them Slack's keys", () => {
    for (const mac of [true, false]) {
      const global = new Set(
        Object.values(SHORTCUTS)
          .filter((shortcut) => shortcut.area === 'General')
          .flatMap((shortcut) => shortcutKeys(shortcut, mac)),
      );
      const sharing = Object.entries(SHORTCUTS)
        // Views bind their own keys while they show (graphs, lists); a comment field's must say where they win.
        .filter(([, shortcut]) => shortcut.area === 'Comments' && shortcutKeys(shortcut, mac).some((key) => global.has(key)))
        .filter(([, shortcut]) => (shortcut as ShortcutDefinition).scope !== 'commentField')
        .map(([id]) => id);
      expect(sharing, mac ? 'macOS' : 'off macOS').toEqual([]);
    }
    expect(SHORTCUTS.commentLink.keys).toEqual(['mod+shift+u']);
    expect(SHORTCUTS.commentCode.keys).toEqual(['mod+shift+c']);
    // Saving the comment is the field's own key too, bound by the field (`focusMode`, the composers), so it takes no scope.
    const formatting = Object.entries(SHORTCUTS).filter(([id, candidate]) => candidate.area === 'Comments' && id !== 'saveComment');
    for (const [, shortcut] of formatting) expect((shortcut as ShortcutDefinition).scope).toBe('commentField');
  });

  it('writes keys the formatter and matcher understand', () => {
    // A lone modifier is one held while the pointer acts (Shift while dropping a folder): the formatter shows it, no key binds it.
    for (const key of everyKey()) expect(key).toMatch(/^(shift|((mod|ctrl|alt|shift)\+)*([a-z0-9]|f\d+|[-=,/[\]?\\]|plus|space|enter|escape|tab|backspace|delete|up|down|left|right|home|end|pageup|pagedown))$/);
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
    expect(shortcutKeys(SHORTCUTS.fileHistory, false)).toEqual(['mod+h']);
    expect(shortcutKeys(SHORTCUTS.fileHistory, true)).toEqual(['mod+y']);
  });

  it('cuts and pastes files with the clipboard keys of each OS, and cancels with Esc', () => {
    for (const mac of [true, false]) {
      expect(shortcutKeys(SHORTCUTS.cutItems, mac)).toEqual(['mod+x']);
      expect(shortcutKeys(SHORTCUTS.pasteItems, mac)).toEqual(['mod+v']);
      expect(shortcutKeys(SHORTCUTS.cancelCut, mac)).toEqual(['escape']);
    }
  });

  it('leaves undo and redo to text off macOS, where Ctrl+Y is Redo', () => {
    // Redo in the text is the text's own key: the editor's, which its menu shows (`codeMenu`).
    const notTextRedo = Object.entries(SHORTCUTS).filter(([id]) => id !== 'textRedo');
    for (const key of notTextRedo.flatMap(([, shortcut]) => shortcutKeys(shortcut, false))) expect(['mod+y', 'mod+shift+z'], key).not.toContain(key);
  });

  it("gives the text each OS's editing keys: Redo, Replace (never ⌘H, which hides the app on macOS) and Go to line", () => {
    expect(shortcutKeys(SHORTCUTS.textRedo, true)).toEqual(['mod+shift+z']);
    expect(shortcutKeys(SHORTCUTS.textRedo, false)).toEqual(['mod+y']);
    expect(shortcutKeys(SHORTCUTS.textReplace, true)).toEqual(['mod+alt+f']);
    expect(shortcutKeys(SHORTCUTS.textReplace, false)).toEqual(['mod+h']);
    // ⌘G is Find next on macOS.
    expect(shortcutKeys(SHORTCUTS.goToLine, true)).toEqual(['ctrl+g']);
    expect(shortcutKeys(SHORTCUTS.goToLine, false)).toEqual(['mod+g']);
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

/** Each `useMemo(…)` and `useCallback(…)` of a source: its line, its body and its dependencies (the last array). */
function memosIn(text: string): { line: number; body: string; deps: string }[] {
  return [...text.matchAll(/\buse(?:Memo|Callback)(?:<[^>]*>)?\(/g)].map((match) => {
    const open = match.index + match[0].length - 1;
    const body = text.slice(open, closingBracket(text, open) + 1);
    return { line: text.slice(0, match.index).split('\n').length, body, deps: body.slice(body.lastIndexOf('[')) };
  });
}

/**
 * Each constant a module declares at its top level with a value (not a function): its line and what it's set to,
 * up to the next line at the top level.
 */
function moduleConstants(text: string): { line: number; initializer: string }[] {
  const lines = text.split('\n');
  return lines.flatMap((line, index) => {
    const declared = /^(?:export )?const \w+(?::[^=]+)? = (.*)$/.exec(line);
    if (!declared || /^(?:\([^)]*\)|\w+) =>|^function\b|^async\b/.test(declared[1]!)) return [];
    const end = lines.findIndex((next, nextIndex) => nextIndex > index && /^\S/.test(next));
    return [{ line: index + 1, initializer: lines.slice(index, end === -1 ? undefined : end).join('\n') }];
  });
}

function closingBracket(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if ('([{'.includes(text[index]!)) depth++;
    else if (')]}'.includes(text[index]!) && --depth === 0) return index;
  }
  return text.length - 1;
}

function readsKeysOf(body: string, ids: readonly string[]): boolean {
  return [...body.matchAll(/\bhotkeys?\('(\w+)'\)/g)].some(([, id]) => ids.includes(id!));
}
