import { Suspense, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react';
import { classNames } from '../../lib/classNames';
import { lazyComponent } from '../../lib/lazyComponent';
import { isModPressed } from '../../lib/shortcuts';
import { enterAction, modEnterAction } from './fieldKeys';
import type { CommentFieldProps } from './commentFieldProps';
import styles from './CommentField.module.css';

type LiveEditor = typeof import('./LiveCommentEditor').LiveCommentEditor;

/** The editor once its code is in: a field then renders it at once, as a lazy component suspends on its first render. */
let loadedEditor: LiveEditor | null = null;
let loading: Promise<LiveEditor> | null = null;

/** The editor and CodeMirror load apart from the app's start (ARCHITECTURE.md "One layout from the first frame"). */
function loadEditor(): Promise<LiveEditor> {
  loading ??= import('./LiveCommentEditor').then((module) => (loadedEditor = module.LiveCommentEditor));
  return loading;
}

const LazyCommentEditor = lazyComponent(loadEditor);

/** Starts loading the editor before a field needs it: at idle after start-up (`main.tsx`), and as a field mounts. */
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
  // Chosen once per field: a field that showed the lazy one keeps it, never mounting its editor again as the code lands.
  const [LiveCommentEditor] = useState(() => loadedEditor);
  useEffect(preloadCommentEditor, []);
  if (LiveCommentEditor) return <LiveCommentEditor {...props} initialFocus={fallbackFocus} />;
  return (
    <Suspense fallback={<PlainCommentField {...props} focusRef={fallbackFocus} />}>
      <LazyCommentEditor {...props} initialFocus={fallbackFocus} />
    </Suspense>
  );
}

/** The field before the editor loads: the same box and text, a plain input or textarea. */
function PlainCommentField({ value, onChange, singleLine = false, label, id, labelledBy, groupField: _groupField, placeholder, autoFocus, disabled, onEnter, onSubmit, className, style, ref, focusRef }: CommentFieldProps & { focusRef: { current: { at: number } | null } }) {
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({
    focus: () => field.current?.focus(),
    focusAtEnd: () => {
      field.current?.focus();
      field.current?.setSelectionRange(value.length, value.length);
    },
    focusAtStart: () => {
      field.current?.focus();
      field.current?.setSelectionRange(0, 0);
    },
  }));
  const remember = (): void => {
    focusRef.current = { at: field.current?.selectionStart ?? value.length };
  };
  // The editor's decision (`fieldKeys`), so the keys work the same before it loads.
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    const inForm = field.current?.form != null;
    const mod = isModPressed(event);
    const action = mod ? modEnterAction({ singleLine, hasHandler: Boolean(onSubmit), inForm }) : enterAction({ singleLine, hasHandler: Boolean(onEnter), inForm });
    if (action === 'window' || action === 'newLine') return;
    event.preventDefault();
    if (action === 'owner') (mod ? onSubmit : onEnter)?.();
    else if (action === 'form') field.current?.form?.requestSubmit();
  };
  const shared = {
    ref: field,
    id,
    className: styles.plain,
    value,
    placeholder,
    ...(labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': label }),
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
