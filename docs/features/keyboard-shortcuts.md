# Keyboard shortcuts

Every shortcut of the app is declared once, in `shared/shortcuts/shortcutRegistry.ts` (`SHORTCUTS`). The renderer binds
and shows a shortcut's keys through `hotkey(id)` and `hotkeys(id)` (`renderer/src/lib/shortcutRegistry.ts`); a test
rejects a shortcut written anywhere else (`lib/shortcutRegistry.test.ts`). The shortcuts sheet (`?`, ⌘/) lists them all
(`shortcutSheet`). This doc covers how a person changes them: Settings ▸ Keyboard.

## Which shortcuts can change

Only the ones marked `customizable` in the registry: the shortcuts that run a command (New branch, Refresh, Next
change, Merge). The others stay as they are:

- the keys every app shares: Esc, Enter, the arrows, Home and End, Space;
- the text's own keys (the Text area), which its editor keeps;
- keys that act on what's under them: a list's, the palette's, a comment's formatting, the model and image viewers';
- the views' keys, ⌘1 to ⌘9, which follow the sidebar's order (`viewShortcut`).

A new shortcut can't change until it's marked, so it's never offered before every place that reads its keys follows a
change ("Keys follow a change at once").

## What the settings keep

`AppSettings.customShortcuts` holds only the shortcuts a person changed, by id: each with the keys it takes now (the
one they pressed, or those left after another shortcut took one of its keys), or none (`[]`) when they removed it. A shortcut given back the keys it came with drops out (`withShortcutKey`), so a
person who changed nothing keeps nothing, and a later version's new default keys reach them.

`keymapOf` makes the keymap, every shortcut's keys on this OS, from the registry and those settings:

- a changed shortcut takes the person's keys, while it is still `customizable` and the keys are still ones it may take
  (`keyProblem`); otherwise it takes the registry's again;
- a shortcut a later version removes is ignored;
- **a key a person chose stays theirs**: when a later version gives that key to another shortcut that can change, and
  they'd clash, that shortcut loses it, and the sheet shows it without it;
- but a shortcut that can't change always keeps its keys: when a later version gives one of them to it, the person's
  choice that clashes with it is dropped, and their shortcut takes the registry's keys again.

## Clashes

Two shortcuts clash (`clash`) when one key would run both: one of the whole window (General) and any other, or two of
areas one screen shows together (`SHOWN_TOGETHER`), since each binds its keys while it shows. Lists, Diff and Text are
bound inside many views (Changes shows a diff beside its list, and the diff's text), so their keys meet those of every
view they show in; a new view that shows them joins that table. A view shows a diff or an annotation, never both, so
each is a row of its own. Shortcuts the registry gives one key on purpose never clash (`sharedByDesign`): they're
bound where the other isn't (Next change in a diff and Next conflict on the merge page, ⌥↓ both), so a shortcut's own
keys are always free to take back; a test holds it for every shortcut that can change. A comment field's keys take effect only inside a focused
comment field, so they clash only among themselves. General lists a few keys used where they act (saving a comment,
Shift held while dropping or opening); those aren't window-wide.

`keyChoice` decides what a key pressed for a shortcut does:

- **refused**, with the reason shown under the row: a key the OS or the app's own menu takes first (quit, close the
  window, hide, zoom, full screen, screenshots on macOS; Alt+F4, Alt+Tab, Ctrl+Esc elsewhere), a view's ⌘1…, Ctrl+Alt
  off macOS (AltGr types characters there), ⌥ with a letter, digit or symbol and no ⌘ or ⌃ on macOS (it types a
  character there, @ on a German Mac), a key a shortcut that can't change uses, or a key with no ⌘, ⌃, ⌥ (Ctrl or
  Alt) or function key for a shortcut whose own keys all have one or are function keys, since typing would run it (the
  step keys run while typing in the diff: F7 is one of them);
- **unchanged** when it's one of the shortcut's keys already: a shortcut with two keys keeps both (Remove the shortcut,
  then press one, to keep only it);
- **allowed after asking**, when shortcuts it clashes with use the key: "Switch branch uses it." with Use it here, which
  takes the key from them (they keep their other keys);
- **allowed**, saying which shortcuts of other views use it too, when there are any.

## Settings ▸ Keyboard

`KeyboardPane` lists the shortcuts that can change by area (`keyboardRows`). The field finds them by the words of their
names, areas or keys as the screen writes them (⇧⌘W); **Find by keys** finds them by pressing the keys instead. A
row's keys are a button: clicked, it records the next keys pressed (`pressedShortcut`, the inverse of
`matchesShortcut`), Esc or leaving it stops, and the row says what happened (`pressOutcome`). Recording offers Remove
the shortcut. A changed row's name is heavier and has a button that gives it its keys back (`resetOutcome`), which asks
first when a shortcut a person gave those keys to since would lose them; Reset all shortcuts asks first. Esc while
recording stops it and leaves Settings open: the button is marked `TAKES_ESCAPE` (`lib/modalDialog`), which the dialog
leaves Esc to, as Radix would otherwise close the dialog before the button sees the key. The shortcuts sheet's Change shortcuts… opens the pane.

While Settings is open, no window shortcut runs (the dialog is modal), so recording a key never runs its old command.
Keys the OS or the menu bar's roles take first (⌘Q, ⌘W) still do what they do; they're the ones `keyProblem` refuses.

## Keys follow a change at once

`hotkey()` reads the window's keymap (`keymapStore`), which follows the settings, also another window's changes
(`useCustomShortcuts`). What already read a key must read it again when the keymap changes:

- the whole window renders again (`useKeymap` in `App`), and so do the views kept mounted (`KeptView`) and every
  component that binds a key (`useShortcut`);
- a memo that reads a changeable shortcut's keys lists the keymap among its dependencies (`const keymap = useKeymap()`):
  the commands the palette lists and runs are built in such memos. A test fails on one that doesn't
  (`lib/shortcutRegistry.test.ts`); it sees `hotkey('id')` written in the memo, not one read in a function it calls,
  so a memo that calls such a function (`refreshCommand`) depends on the keymap all the same;
- no module keeps a changeable shortcut's keys in a constant read as it loads; a function returns them instead
  (`fileShortcuts`). The same test fails on such a constant;
- code that reads keys as a key is pressed (`matchesShortcut(event, hotkey(id))` in a handler) already reads the new
  ones.

A changeable shortcut may have no key: `hotkey()` is typed `string | undefined` for those ids, and what shows it
(`Kbd`, tooltips) shows nothing then.

## The menu bar

The native menus show each command's shortcut from the same keymap (`menuAccelerator`, by the registry's `commandId`),
and are installed again when the custom shortcuts change (`appMenuInstaller`). A key no Electron accelerator names (ñ
on a Spanish keyboard) shows no keys there; it still runs the command. The menu only shows the keys; the
renderer binds them (`registerAccelerator: false`).
