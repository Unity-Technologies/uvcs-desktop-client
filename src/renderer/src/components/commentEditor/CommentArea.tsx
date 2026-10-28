import { useId } from 'react';
import { classNames } from '../../lib/classNames';
import { FieldFrame, type FieldChrome } from '../../ui/TextField';
import { CommentField } from './CommentField';
import type { CommentFieldProps } from './commentFieldProps';
import styles from './CommentField.module.css';

type CommentAreaProps = Omit<CommentFieldProps, 'className'> & Pick<FieldChrome, 'hint' | 'error'> & {
  /** Taller from the start, for a comment edited whole (Edit comment). */
  tall?: boolean;
};

/**
 * A dialog's comment field under its label, boxed as the dialog's other fields (`TextField`, `TextArea`): one line
 * for a title, several for a comment. ⌘↵ submits the dialog.
 */
export function CommentArea({ label, hint, error, tall = false, singleLine, ...field }: CommentAreaProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <CommentField {...field} id={id} label={label} singleLine={singleLine} className={classNames(styles.box, singleLine ? styles.oneLine : styles.lines, tall && styles.tall)} />
    </FieldFrame>
  );
}
