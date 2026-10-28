import { useId, useRef } from 'react';
import { classNames } from '../../lib/classNames';
import { FieldFrame, type FieldChrome } from '../../ui/TextField';
import { CommentField } from './CommentField';
import type { CommentFieldHandle, CommentFieldProps } from './commentFieldProps';
import styles from './CommentField.module.css';

type CommentAreaProps = Omit<CommentFieldProps, 'className'> & Pick<FieldChrome, 'hint' | 'error'> & {
  /** Taller from the start, for a comment edited whole (Edit comment). */
  tall?: boolean;
};

/**
 * A dialog's comment field under its label, boxed as the dialog's other fields (`TextField`, `TextArea`): one line
 * for a title, several for a comment. ⌘↵ submits the dialog. The editor is no element a `<label htmlFor>` can focus,
 * so a press on the label puts the caret in it, and the label names it (`aria-labelledby`).
 */
export function CommentArea({ label, hint, error, tall = false, singleLine, ...field }: CommentAreaProps) {
  const id = useId();
  const labelId = useId();
  const handle = useRef<CommentFieldHandle>(null);
  return (
    <FieldFrame id={id} labelId={labelId} onLabelPress={() => handle.current?.focusAtEnd()} label={label} hint={hint} error={error}>
      <CommentField
        {...field}
        ref={handle}
        id={id}
        labelledBy={labelId}
        label={label}
        singleLine={singleLine}
        className={classNames(styles.box, singleLine ? styles.oneLine : styles.lines, tall && styles.tall)}
      />
    </FieldFrame>
  );
}
