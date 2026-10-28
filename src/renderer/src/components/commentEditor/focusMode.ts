import type { EditorState } from '@codemirror/state';
import { matchesShortcut, type PressedKey } from '../../lib/shortcuts';
import { SHORTCUTS, shortcutKeys } from '../../lib/shortcutRegistry';

/**
 * Focus mode (docs/features/rich-comments.md, "Writing"): a comment of many lines grows into a large editor over
 * the view, or within the dialog it's in, and back. It is the same editor, its text, caret and selection kept.
 */
export function offersFocusMode(singleLine: boolean): boolean {
  return !singleLine;
}

/**
 * How the larger editor shows: over the view, the rest dimmed behind it; in a dialog, the field grows in place, as
 * the dialog keeps the focus and the clicks within it (one outside would close it).
 */
export function focusModeLayout(inDialog: boolean): FocusModeLayout {
  return inDialog ? 'inPlace' : 'overlay';
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

export type FocusModeLayout = 'overlay' | 'inPlace';

/** The larger editor stays only while it has the focus: a dialog it opened (a check-in's question) or Tab leaves it. */
export function layoutAfterFocus(layout: FocusModeLayout | null, focused: boolean): FocusModeLayout | null {
  return focused ? layout : null;
}

/** The corner button: what it does and its icon, its name alone telling whether the larger editor is open. */
export function focusModeButton(open: boolean): { label: string; icon: 'expand' | 'collapse' } {
  return open ? { label: 'Back to the field', icon: 'collapse' } : { label: 'Write in a larger editor', icon: 'expand' };
}

/** A field's part in focus mode: alone, or one of the check-in's group (`CommentFocusGroup`), open or not. */
export interface FocusModeField {
  singleLine: boolean;
  inGroup: boolean;
  groupOpen: boolean;
  /** A field alone: how its larger editor shows, null while it doesn't. */
  ownLayout: FocusModeLayout | null;
  /** In a dialog (Edit comment, New branch, New label, New attribute), whose comment has the large editor's layout. */
  inDialog: boolean;
}

/** What focus mode shows on a field (`focusModeParts`); the editor only draws it. */
export interface FocusModeParts {
  /** Whether its keys (⇧⌘F, Esc) reach it. */
  offered: boolean;
  /** The field's own box at a writing size (`data-expanded`): a field alone; a group's panel is the group's. */
  layout: FocusModeLayout | null;
  inFocusMode: boolean;
  /** The corner button, on a comment of many lines. */
  button: { label: string; icon: 'expand' | 'collapse' } | null;
  /** The formats' strip at the box's top (`FormatToolbar`). */
  toolbar: boolean;
  /** The hints under the text (`FocusModeFooter`): a field alone's; the group draws its own. */
  footer: boolean;
  /** The dimmed view behind (`overlay`). */
  backdrop: boolean;
  /** Tab indents the text (`focusModeTab`), as the text is the only thing on screen. */
  takesTab: boolean;
}

/**
 * Focus mode's parts on a field: a one-line field alone has none; the check-in's summary takes the group's keys and
 * nothing else; a comment of many lines has the corner button and, in focus mode, the toolbar and Tab, and alone its
 * own hints and box (over the view, the backdrop). In a dialog a comment of many lines has the large editor's layout at
 * the dialog's size: the toolbar and the hints always, focus mode growing it; Tab stays the form's until then.
 */
export function focusModeParts({ singleLine, inGroup, groupOpen, ownLayout, inDialog }: FocusModeField): FocusModeParts {
  const layout = inGroup ? null : ownLayout;
  const inFocusMode = inGroup ? groupOpen : ownLayout !== null;
  const many = !singleLine;
  return {
    offered: offersFocusMode(singleLine) || inGroup,
    layout: many ? layout : null,
    inFocusMode: (many || inGroup) && inFocusMode,
    button: many ? focusModeButton(inFocusMode) : null,
    toolbar: many && (inFocusMode || inDialog),
    footer: many && !inGroup && (inFocusMode || inDialog),
    backdrop: many && layout === 'overlay',
    takesTab: many && inFocusMode,
  };
}

/** Whether a group of fields (`CommentFocusGroup`) shows its hints: in focus mode, and always in a dialog. */
export function groupShowsHints({ open, inDialog }: { open: boolean; inDialog: boolean }): boolean {
  return open || inDialog;
}

/**
 * Where the caret goes as focus mode opens and gives the field the focus: a field never focused since it was made (a
 * workspace switch, Home and back, its draft put back) has its caret at the start, where no one put it, so it goes to
 * the draft's end; one the user was in keeps it. Null leaves it.
 */
export function caretOpeningFocusMode(state: EditorState, focusedBefore: boolean): number | null {
  return !focusedBefore && state.doc.length > 0 ? state.doc.length : null;
}
