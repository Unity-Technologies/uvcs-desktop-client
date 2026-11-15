import type { CSSProperties, ReactNode, Ref } from 'react';
import type { GroupField } from './focusGroup';

/** What a comment field's owner can do with it: put the caret in it. */
export interface CommentFieldHandle {
  focus: () => void;
  /** The caret at the end of the text, as after typing it. */
  focusAtEnd: () => void;
  /** The caret at the text's start. */
  focusAtStart: () => void;
  /** Where the caret and selection are, as offsets in the text: none while the field has no focus. */
  selection: () => FieldSelection | null;
  /** The caret and selection back where they were (`selection`), within the text as it is now; false while the field can't take them yet (its editor still being made). */
  focusAtSelection: (selection: FieldSelection) => boolean;
  /**
   * Opens the change requests to apply at the caret, or at the text's end when the field has no focus
   * (`openChangeRequests`). Before the editor loads, it opens as soon as it does. False while the field is disabled.
   */
  openChangeRequests: () => boolean;
}

/** A caret, or a selection from `anchor` to `head`, as offsets in a field's text. */
export interface FieldSelection {
  anchor: number;
  head: number;
}

/** A comment field: the text in and out as stored, never converted (docs/features/rich-comments.md, "Writing"). */
export interface CommentFieldProps {
  value: string;
  onChange: (text: string) => void;
  /** A summary or a title: one line, inline formats only, compact chips. */
  singleLine?: boolean;
  /** Its name for screen readers, where no label shows it. */
  label: string;
  /** The plain field's id before the editor loads, which its `<label htmlFor>` names (`CommentArea`). */
  id?: string;
  /** The id of the label shown above the field, which names the editor (`fieldLabelAttributes`). */
  labelledBy?: string;
  /** In a popover, which can't hold the larger editor's panel: a comment of many lines offers none (`isOwnFocusGroup`). */
  inPopover?: boolean;
  /** Its part in a `CommentFocusGroup` (the check-in's summary or description): focus mode opens the group. */
  groupField?: GroupField;
  placeholder: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** One line: Enter. Without it, Enter submits the field's form, as an input's does. */
  onEnter?: () => void;
  /** ⌘↵. Without it, ⌘↵ submits the field's form, or else is the window's (check in, merge). */
  onSubmit?: () => void;
  /** The field's box: its border, background, padding and size, its focus ring on `:focus-within`. */
  className?: string;
  style?: CSSProperties;
  /** A quiet row at the field's bottom-left, inside its box (the check-in's change requests button); none by default. */
  footer?: ReactNode;
  ref?: Ref<CommentFieldHandle>;
}
