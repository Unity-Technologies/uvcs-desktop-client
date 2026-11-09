import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { classNames } from '../lib/classNames';
import styles from './Field.module.css';

export interface FieldChrome {
  label?: string;
  hint?: string;
  error?: string;
}

interface FieldFrameProps extends FieldChrome {
  id: string;
  /** The label's own id, for a field named by `aria-labelledby` (one `htmlFor` can't name: a contenteditable). */
  labelId?: string;
  /** A press on the label, for a field `htmlFor` can't focus: it puts the caret in it itself. */
  onLabelPress?: () => void;
  children: React.ReactNode;
}

/** A field's label above it and its error, or else its hint, below. */
export function FieldFrame({ id, labelId, onLabelPress, label, hint, error, children }: FieldFrameProps) {
  return (
    <div className={styles.field}>
      {label && (
        <label
          className={styles.label}
          htmlFor={id}
          id={labelId}
          onMouseDown={
            onLabelPress &&
            ((event) => {
              event.preventDefault();
              onLabelPress();
            })
          }
        >
          {label}
        </label>
      )}
      {children}
      {error ? <span className={styles.error}>{error}</span> : hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

export const TextField = forwardRef<HTMLInputElement, FieldChrome & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, hint, error, className, ...rest }, ref) {
    const id = useId();
    return (
      <FieldFrame id={id} label={label} hint={hint} error={error}>
        <input ref={ref} id={id} className={classNames(styles.input, className)} spellCheck={false} {...rest} />
      </FieldFrame>
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, FieldChrome & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ label, hint, error, className, ...rest }, ref) {
    const id = useId();
    return (
      <FieldFrame id={id} label={label} hint={hint} error={error}>
        <textarea ref={ref} id={id} className={classNames(styles.input, styles.textarea, className)} {...rest} />
      </FieldFrame>
    );
  },
);

export const SelectField = forwardRef<HTMLSelectElement, FieldChrome & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, hint, error, className, children, ...rest }, ref) {
    const id = useId();
    return (
      <FieldFrame id={id} label={label} hint={hint} error={error}>
        <select ref={ref} id={id} className={classNames(styles.input, styles.select, className)} {...rest}>
          {children}
        </select>
      </FieldFrame>
    );
  },
);
