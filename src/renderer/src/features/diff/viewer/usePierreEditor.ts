import { FileDiff } from '@pierre/diffs';
import { Editor } from '@pierre/diffs/edit';
import type { EditProvider } from '@pierre/diffs/react';
import { useImperativeHandle, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { shownText } from '../../../lib/lineBreaks';
import type { EditorHandle } from './editorHandle';
import { isTypingIn } from './pierreDom';
import { replacementEdit } from './replacementEdit';

type CreateEditor = ComponentProps<typeof EditProvider>['createEditor'];

export interface PierreEditor {
  /** The editor holding the diff's modified text, once Pierre created it. */
  editor: RefObject<Editor | null>;
  /** The diff the editor attached to (not the whole-file editor's file). */
  fileDiff: RefObject<FileDiff<unknown, unknown> | null>;
  /** For `EditProvider`: creates the editors Pierre asks for, keeping the latest. */
  createEditor: CreateEditor;
}

/**
 * The editor Pierre creates for a diff typed into, held so the viewer acts on its text (discards, undo, focus) and
 * handed to the viewer as its `EditorHandle` (`editorRef`).
 */
export function usePierreEditor(editorRef: RefObject<EditorHandle | null> | undefined, containerRef: RefObject<HTMLElement | null>): PierreEditor {
  const editor = useRef<Editor | null>(null);
  const fileDiff = useRef<FileDiff<unknown, unknown> | null>(null);
  const [createEditor] = useState(() => {
    const create: CreateEditor = (type, options, key) => {
      const onAttach: typeof options.onAttach = (attached, surface) => {
        options.onAttach?.(attached, surface);
        fileDiff.current = surface instanceof FileDiff ? surface : null;
      };
      const created = new Editor(type, { ...options, onAttach }, key);
      editor.current = created as unknown as Editor;
      return created;
    };
    return create;
  });

  useImperativeHandle(
    editorRef,
    () => ({
      setText: (text) => {
        const edit = editor.current && replacementEdit(editor.current.getText(), shownText(text));
        if (edit) editor.current!.applyEdits([edit]);
      },
      undo: () => editor.current?.undo(),
      focus: () => {
        const hadCaret = (editor.current?.getViewState().selections?.length ?? 0) > 0;
        editor.current?.focus(hadCaret ? undefined : { lineNumber: 'first-visible' });
      },
      hasFocus: () => isTypingIn(containerRef.current),
    }),
    [containerRef],
  );

  return { editor, fileDiff, createEditor };
}
