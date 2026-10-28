import { Suspense, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from 'react';
import { classNames } from '../../lib/classNames';
import { lazyComponent } from '../../lib/lazyComponent';
import type { CommentFieldProps } from './commentFieldProps';
import styles from './CommentField.module.css';

/** The editor and CodeMirror load apart from the app's start (ARCHITECTURE.md "One layout from the first frame"). */
const loadEditor = () => import('./LiveCommentEditor').then((module) => module.LiveCommentEditor);
const LiveCommentEditor = lazyComponent(loadEditor);

/** Starts loading the editor before a field needs it: at idle after start-up, and as the first field mounts. */
export function preloadCommentEditor(): void {
  void loadEditor();
}

/**
 * A comment field (docs/features/rich-comments.md, "Writing"): the live editor, Markdown drawn as it reads around the
 * caret with chips and suggestions. Until the editor's code arrives, a plain field in the same box takes the typing,
 * and hands the editor its caret, so nothing moves and nothing typed is lost.
 */
export function CommentField(props: CommentFieldProps) {
  const fallbackFocus = useRef<{ at: number } | null>(null);
  useEffect(preloadCommentEditor, []);
  return (
    <Suspense fallback={<PlainCommentField {...props} focusRef={fallbackFocus} />}>
      <LiveCommentEditor {...props} initialFocus={fallbackFocus} />
    </Suspense>
  );
}

/** The field before the editor loads: the same box and text, a plain input or textarea. */
function PlainCommentField({ value, onChange, singleLine = false, label, placeholder, autoFocus, disabled, onEnter, onSubmit, className, style, ref, focusRef }: CommentFieldProps & { focusRef: { current: { at: number } | null } }) {
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({
    focus: () => field.current?.focus(),
    focusAtEnd: () => {
      field.current?.focus();
      field.current?.setSelectionRange(value.length, value.length);
    },
  }));
  const remember = (): void => {
    focusRef.current = { at: field.current?.selectionStart ?? value.length };
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    if (event.metaKey || event.ctrlKey) {
      if (!onSubmit) return;
      event.preventDefault();
      onSubmit();
    } else if (singleLine && onEnter) {
      event.preventDefault();
      onEnter();
    }
  };
  const shared = {
    ref: field,
    className: styles.plain,
    value,
    placeholder,
    'aria-label': label,
    autoFocus,
    disabled,
    spellCheck: true,
    onFocus: remember,
    onSelect: remember,
    onBlur: () => (focusRef.current = null),
    onKeyDown,
  };
  return (
    <div className={classNames(styles.field, className)} style={style}>
      {singleLine ? <input {...shared} onChange={(event) => onChange(event.target.value)} /> : <textarea {...shared} onChange={(event) => onChange(event.target.value)} />}
    </div>
  );
}
