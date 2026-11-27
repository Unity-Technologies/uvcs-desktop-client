/**
 * The keys every shortcut takes: the registry's (`SHORTCUTS`), with the keys a person gave the ones they changed in
 * Settings ▸ Keyboard (`AppSettings.customShortcuts`). docs/features/keyboard-shortcuts.md holds the rules.
 */
import { SHORTCUTS, shortcutKeys, viewShortcut, type ShortcutArea, type ShortcutDefinition, type ShortcutId } from './shortcutRegistry';

/**
 * The keys a person gave shortcuts, by shortcut id: only the ones they changed, each with the keys it takes now (the
 * one they pressed, or those left after another shortcut took one of its keys), or none (no shortcut). Written as the
 * registry writes keys, for the OS of the machine that keeps them.
 */
export type CustomShortcuts = Readonly<Record<string, readonly string[]>>;

/** Every shortcut's keys on this OS, the binding first; none where it has none. */
export type Keymap = Readonly<Record<ShortcutId, readonly string[]>>;

const IDS = Object.keys(SHORTCUTS) as ShortcutId[];

/** The views' keys in the sidebar (⌘1…): as many as a place may show, and more. */
const VIEW_POSITIONS = 14;

/**
 * Every shortcut's keys. A shortcut a person changed takes their keys (when it can still change, and they're still
 * keys it may take); every other one the registry's, but for the keys a person gave a shortcut it would clash with:
 * a key the app gives a shortcut that can change, in a later version, never takes one a person chose. One that can't
 * change keeps its keys, and the person's choice that clashes with it is dropped.
 */
export function keymapOf(custom: CustomShortcuts, mac: boolean): Keymap {
  const chosen = chosenKeys(custom, mac);
  const keymap = {} as Record<ShortcutId, readonly string[]>;
  for (const id of IDS) {
    keymap[id] = chosen.get(id) ?? shortcutKeys(SHORTCUTS[id], mac).filter((key) => !takenByChoice(id, key, chosen));
  }
  return keymap;
}

function chosenKeys(custom: CustomShortcuts, mac: boolean): Map<ShortcutId, readonly string[]> {
  const chosen = new Map<ShortcutId, readonly string[]>();
  for (const id of IDS) {
    const keys = custom[id];
    if (!isCustomizable(id) || !keys) continue;
    if (keys.every((key) => keyProblem(id, key, mac) === undefined && !takenByFixed(id, key, mac))) chosen.set(id, keys.map(canonicalKey));
  }
  return chosen;
}

function takenByChoice(id: ShortcutId, key: string, chosen: ReadonlyMap<ShortcutId, readonly string[]>): boolean {
  if (!isCustomizable(id)) return false;
  const pressed = canonicalKey(key);
  return [...chosen].some(([other, keys]) => other !== id && keys.includes(pressed) && clash(id, other));
}

function takenByFixed(id: ShortcutId, key: string, mac: boolean): boolean {
  const pressed = canonicalKey(key);
  return IDS.some((other) => other !== id && !isCustomizable(other) && clash(id, other) && shortcutKeys(SHORTCUTS[other], mac).some((taken) => canonicalKey(taken) === pressed));
}

/**
 * Whether two shortcuts would both run on one key: one of the whole window (General) and any other, or two of areas
 * a screen shows together (`SHOWN_TOGETHER`), since each binds its keys while it shows. A comment field's keys win
 * inside a focused comment field, and only there, so they clash only among themselves.
 */
export function clash(a: ShortcutId, b: ShortcutId): boolean {
  const first: ShortcutDefinition = SHORTCUTS[a];
  const second: ShortcutDefinition = SHORTCUTS[b];
  if ((first.scope === 'commentField') !== (second.scope === 'commentField')) return false;
  if (sharedByDesign(first, second)) return false;
  return shownTogether(first.area, second.area) || isWindowWide(a) || isWindowWide(b);
}

/**
 * Shortcuts the registry gives one key on purpose never run together: they're bound where the other isn't (the merge
 * page's Next conflict and a diff's Next change, a diff's Type in the file and History's Into the diff). On either OS.
 */
function sharedByDesign(first: ShortcutDefinition, second: ShortcutDefinition): boolean {
  const keysOf = (shortcut: ShortcutDefinition) => [...shortcut.keys, ...(shortcut.keysOffMac ?? [])].map(canonicalKey);
  const secondKeys = new Set(keysOf(second));
  return keysOf(first).some((key) => secondKeys.has(key));
}

/**
 * The areas each screen shows at once: a view with its list, and the diff (with its text) or the annotation beside
 * it, one or the other. Lists, Diff and Text are bound inside many views, so their keys meet those of each view they
 * show in. The merge page steps through conflicts with keys of its own (Merge).
 */
const SHOWN_TOGETHER: readonly (readonly ShortcutArea[])[] = [
  ['Changes', 'Lists', 'Diff', 'Text', 'Image diff', 'Model diff'],
  ['Files', 'Lists', 'Diff', 'Text', 'Image diff', 'Model diff'],
  ['Files', 'Lists', 'Annotate'],
  ['History', 'Lists', 'Diff', 'Text', 'Image diff', 'Model diff'],
  ['History', 'Lists', 'Annotate'],
  ['Merge', 'Lists', 'Text'],
  ['Branch Explorer', 'Lists'],
];

function shownTogether(first: ShortcutArea, second: ShortcutArea): boolean {
  return first === second || SHOWN_TOGETHER.some((screen) => screen.includes(first) && screen.includes(second));
}

/**
 * General's shortcuts run from anywhere in the window, but for the ones General lists that act where they're used:
 * saving the comment being written, and Shift held while dropping a folder or opening a workspace.
 */
const BOUND_WHERE_USED: readonly ShortcutId[] = ['saveComment', 'dropInNewWindow', 'workspaceInNewWindow'];

function isWindowWide(id: ShortcutId): boolean {
  return SHORTCUTS[id].area === 'General' && !BOUND_WHERE_USED.includes(id);
}

/** The shortcuts that take `key` now, besides `id`: those it clashes with first, then the others. */
export function otherShortcutsOn(id: ShortcutId, key: string, keymap: Keymap): { clashing: ShortcutId[]; elsewhere: ShortcutId[] } {
  const pressed = canonicalKey(key);
  const others = IDS.filter((other) => other !== id && keymap[other].some((taken) => canonicalKey(taken) === pressed));
  return { clashing: others.filter((other) => clash(id, other)), elsewhere: others.filter((other) => !clash(id, other)) };
}

/** What giving shortcut `id` the key pressed would do, before it's given. */
export type KeyChoice =
  /** It can't: `reason` says why. */
  | { kind: 'refused'; reason: string }
  /** It's already its key. */
  | { kind: 'unchanged' }
  /** It can: `takenFrom` lose it (`withShortcutKey`); `elsewhere` keep it, in views of their own. */
  | { kind: 'allowed'; takenFrom: ShortcutId[]; elsewhere: ShortcutId[] };

export function keyChoice(id: ShortcutId, key: string, keymap: Keymap, mac: boolean): KeyChoice {
  const problem = keyProblem(id, key, mac);
  if (problem) return { kind: 'refused', reason: problem };
  if (keymap[id].some((taken) => canonicalKey(taken) === canonicalKey(key))) return { kind: 'unchanged' };
  const { clashing, elsewhere } = otherShortcutsOn(id, key, keymap);
  const fixed = clashing.find((other) => !isCustomizable(other));
  if (fixed) return { kind: 'refused', reason: `${SHORTCUTS[fixed].label} (${SHORTCUTS[fixed].area}) takes it, and can't change.` };
  return { kind: 'allowed', takenFrom: clashing, elsewhere };
}

/**
 * The custom shortcuts once `id` takes `key` alone: the shortcuts it clashes with that can change lose the key
 * (keeping their others); one that can't change keeps it, and `id` can't take it (`keyChoice` says so first). A shortcut
 * given back its registry keys drops out, so the settings keep only what differs.
 */
export function withShortcutKey(custom: CustomShortcuts, keymap: Keymap, id: ShortcutId, key: string | null, mac: boolean): CustomShortcuts {
  const next: Record<string, readonly string[]> = { ...custom, [id]: key === null ? [] : [canonicalKey(key)] };
  if (key !== null) {
    for (const other of otherShortcutsOn(id, key, keymap).clashing) {
      next[other] = keymap[other].filter((taken) => canonicalKey(taken) !== canonicalKey(key));
    }
  }
  return withoutDefaults(next, mac);
}

/**
 * The shortcuts that would lose a key if `id` took its registry keys again: those a person gave one of them since,
 * where they clash. Giving them back asks first, as pressing the key would.
 */
export function defaultKeysTakenFrom(id: ShortcutId, keymap: Keymap, mac: boolean): ShortcutId[] {
  const defaults = shortcutKeys(SHORTCUTS[id], mac).map(canonicalKey);
  return IDS.filter((other) => other !== id && isCustomizable(other) && clash(id, other) && keymap[other].some((key) => defaults.includes(canonicalKey(key))));
}

/** The custom shortcuts once `id` takes its registry keys again, taking them from the shortcuts that have them since. */
export function withDefaultKeys(custom: CustomShortcuts, keymap: Keymap, id: ShortcutId, mac: boolean): CustomShortcuts {
  const defaults = shortcutKeys(SHORTCUTS[id], mac).map(canonicalKey);
  const { [id]: _dropped, ...next } = custom as Record<string, readonly string[]>;
  for (const other of defaultKeysTakenFrom(id, keymap, mac)) next[other] = keymap[other].filter((key) => !defaults.includes(canonicalKey(key)));
  return withoutDefaults(next, mac);
}

function withoutDefaults(custom: Record<string, readonly string[]>, mac: boolean): CustomShortcuts {
  const kept = Object.entries(custom).filter(([id, keys]) => {
    const defaults = id in SHORTCUTS ? shortcutKeys(SHORTCUTS[id as ShortcutId], mac).map(canonicalKey) : [];
    return !(keys.length === defaults.length && keys.every((key, index) => key === defaults[index]));
  });
  return Object.fromEntries(kept);
}

/** Whether a person may give a shortcut other keys (`ShortcutDefinition.customizable`). */
export function isCustomizable(id: ShortcutId): boolean {
  return (SHORTCUTS[id] as ShortcutDefinition).customizable === true;
}

/** Whether a shortcut takes keys other than the registry's. */
export function isChanged(custom: CustomShortcuts, id: ShortcutId): boolean {
  return id in custom;
}

/** Why `key` can't run shortcut `id`, in a sentence for the person who pressed it; undefined when it can. */
export function keyProblem(id: ShortcutId, key: string, mac: boolean): string | undefined {
  const parts = canonicalKey(key).split('+');
  const modifiers = parts.slice(0, -1);
  const pressed = parts.join('+');
  const reserved = (mac ? MAC_RESERVED : OTHER_RESERVED)[pressed];
  if (reserved) return reserved;
  if (viewKeys(mac).has(pressed)) return 'Goes to a view of the sidebar.';
  if (!mac && (modifiers.includes('mod') || modifiers.includes('ctrl')) && modifiers.includes('alt')) {
    return 'Ctrl+Alt types characters on many keyboards.';
  }
  if (mac && modifiers.includes('alt') && !modifiers.includes('mod') && !modifiers.includes('ctrl') && typesACharacter(parts.at(-1)!)) {
    return '⌥ with a letter, digit or symbol types a character.';
  }
  const commandKey = modifiers.some((modifier) => modifier !== 'shift') || /^f\d+$/.test(parts.at(-1)!);
  if (!commandKey && !takesPlainKeys(SHORTCUTS[id], mac)) return `Needs ${mac ? '⌘, ⌃ or ⌥' : 'Ctrl or Alt'}, or a function key, so it doesn't type.`;
  return undefined;
}

/**
 * A shortcut whose own keys need no modifier (N, the next comment) is bound where typing never reaches it: it may take
 * another such key. The others would run while a person types.
 */
function takesPlainKeys(shortcut: ShortcutDefinition, mac: boolean): boolean {
  return shortcutKeys(shortcut, mac).some((key) => {
    const parts = canonicalKey(key).split('+');
    return !/^f\d+$/.test(parts.at(-1)!) && !parts.slice(0, -1).some((modifier) => modifier !== 'shift');
  });
}

/** A key that types a character by itself: a letter, a digit or a symbol, not a named key (an arrow, F7, Enter). */
function typesACharacter(key: string): boolean {
  return [...key].length === 1 || key === 'plus' || key === 'space';
}

function viewKeys(mac: boolean): Set<string> {
  return new Set(Array.from({ length: VIEW_POSITIONS }, (_, position) => viewShortcut(position, mac)));
}

/** Keys the OS or the app's own menu takes before a shortcut sees them, and what they do. */
const MAC_RESERVED: Readonly<Record<string, string>> = {
  'mod+q': 'Quits the app.',
  'mod+w': 'Closes the window.',
  'mod+h': 'Hides the app.',
  'mod+alt+h': 'Hides the other apps.',
  'mod+m': 'Minimizes the window.',
  'mod+tab': 'Switches apps.',
  'mod+`': 'Switches windows.',
  'mod+space': 'Opens Spotlight.',
  'mod+ctrl+f': 'Makes the window full screen.',
  'mod+0': 'Sets the zoom back to actual size.',
  'mod+plus': 'Zooms in.',
  'mod+=': 'Zooms in.',
  'mod+-': 'Zooms out.',
  'mod+shift+3': 'Takes a screenshot.',
  'mod+shift+4': 'Takes a screenshot.',
  'mod+shift+5': 'Takes a screenshot.',
};

const OTHER_RESERVED: Readonly<Record<string, string>> = {
  'alt+f4': 'Closes the window.',
  'alt+tab': 'Switches windows.',
  'alt+space': "Opens the window's menu.",
  'alt+escape': 'Switches windows.',
  'mod+escape': 'Opens the Start menu.',
  'mod+shift+escape': 'Opens the Task Manager.',
  'mod+w': 'Closes the window.',
  'mod+q': 'Quits the app.',
  f11: 'Makes the window full screen.',
  'mod+0': 'Sets the zoom back to actual size.',
  'mod+plus': 'Zooms in.',
  'mod+=': 'Zooms in.',
  'mod+-': 'Zooms out.',
};

const MODIFIER_ORDER = ['mod', 'ctrl', 'alt', 'shift'];

/** A key as the registry writes it: its modifiers in one order (`mod+ctrl+alt+shift+k`), so equal keys compare equal. */
export function canonicalKey(key: string): string {
  const parts = key.split('+');
  if (parts.length === 1) return key;
  const modifiers = parts.slice(0, -1).sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
  return [...modifiers, parts.at(-1)!].join('+');
}
