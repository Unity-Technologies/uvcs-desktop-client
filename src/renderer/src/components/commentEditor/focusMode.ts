import type { EditorState } from '@codemirror/state';
import { matchesShortcut, type PressedKey } from '../../lib/shortcuts';
import { SHORTCUTS, shortcutKeys } from '../../lib/shortcutRegistry';

/**
 * Focus mode (docs/features/rich-comments.md, "Writing"): a comment of many lines grows into a large editor over
 * the window, a dialog's too, and back. It is the same editor, its text, caret and selection kept.
 */
export function offersFocusMode(singleLine: boolean): boolean {
  return !singleLine;
}

/**
 * How the larger editor shows, the same everywhere (`focusModeFor`): a panel over the window, the rest dimmed behind
 * it, above the dialog it opened from. Growing a dialog's field in place was dropped: the dialog grew too tall, or
 * its field barely grew, by how much room its other fields left.
 */
export function focusModeLayout(): FocusModeLayout {
  return 'overlay';
}

/**
 * What a key does to focus mode: its shortcut goes in and out (`toggle`), Esc out (`collapse`), once the
 * suggestions are closed, and ⌘↵ out as it goes on to save (`submitting`); null leaves the key to the text.
 */
export function focusModeKey(event: PressedKey, mac: boolean, state: { expanded: boolean; suggesting: boolean }): 'toggle' | 'collapse' | 'submitting' | null {
  if (shortcutKeys(SHORTCUTS.commentFocusMode, mac).some((key) => matchesShortcut(event, key, mac))) return 'toggle';
  // ⌘↵ saves or checks in: the field closes the larger editor, the key going on to do its work.
  if (state.expanded && shortcutKeys(SHORTCUTS.saveComment, mac).some((key) => matchesShortcut(event, key, mac))) return 'submitting';
  if (event.key === 'Escape' && state.expanded && !state.suggesting) return 'collapse';
  return null;
}

export type FocusModeLayout = 'overlay';

/** The corner button: what it does and its icon, its name alone telling whether the larger editor is open. */
export function focusModeButton(open: boolean): { label: string; icon: 'expand' | 'collapse' } {
  return open ? { label: 'Back to the field', icon: 'collapse' } : { label: 'Write in a larger editor', icon: 'expand' };
}

/**
 * A field's part in focus mode: one of a group (`CommentFocusGroup`, whose panel is the one larger editor; a comment
 * of many lines on its own is a group of one, `CommentField`), open or not, or a one-line field on its own.
 */
export interface FocusModeField {
  singleLine: boolean;
  inGroup: boolean;
  groupOpen: boolean;
}

/** What focus mode shows on a field (`focusModeParts`); the editor only draws it. */
export interface FocusModeParts {
  /** Whether its keys (⇧⌘F, Esc) reach it. */
  offered: boolean;
  inFocusMode: boolean;
  /** The corner button, on a comment of many lines. */
  button: { label: string; icon: 'expand' | 'collapse' } | null;
  /** The formats' strip at the box's top (`FormatToolbar`). */
  toolbar: boolean;
  /** Tab indents the text (`focusModeTab`), as the text is the only thing on screen. */
  takesTab: boolean;
}

/**
 * Focus mode's parts on a field: a one-line field on its own has none; the check-in's summary takes the group's keys
 * and nothing else; a comment of many lines, its group's description, has the corner button and, in focus mode, the
 * toolbar and Tab. The panel, its backdrop and its hints are the group's (`CommentFocusGroup`), never a field's.
 */
export function focusModeParts({ singleLine, inGroup, groupOpen }: FocusModeField): FocusModeParts {
  const many = !singleLine && inGroup;
  const inFocusMode = inGroup && groupOpen;
  return {
    offered: inGroup,
    inFocusMode,
    button: many ? focusModeButton(inFocusMode) : null,
    toolbar: many && inFocusMode,
    takesTab: many && inFocusMode,
  };
}

/**
 * Where the caret goes as focus mode opens and gives the field the focus: a field never focused since it was made (a
 * workspace switch, Home and back, its draft put back) has its caret at the start, where no one put it, so it goes to
 * the draft's end; one the user was in keeps it. Null leaves it.
 */
export function caretOpeningFocusMode(state: EditorState, focusedBefore: boolean): number | null {
  return !focusedBefore && state.doc.length > 0 ? state.doc.length : null;
}
