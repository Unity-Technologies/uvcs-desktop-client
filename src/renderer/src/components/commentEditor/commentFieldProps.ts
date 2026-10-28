import type { CSSProperties, Ref } from 'react';

/** What a comment field's owner can do with it: put the caret in it. */
export interface CommentFieldHandle {
  focus: () => void;
  /** The caret at the end of the text, as after typing it. */
  focusAtEnd: () => void;
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
  ref?: Ref<CommentFieldHandle>;
}
