import { FileDiff } from '@pierre/diffs';
import { Editor, type EditorFocusOptions } from '@pierre/diffs/edit';
import type { EditProvider } from '@pierre/diffs/react';
import { useImperativeHandle, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { shownText } from '../../../lib/lineBreaks';
import type { EditorHandle } from './editorHandle';
import { MAX_WAIT_FOR_COLORS_MS } from './editorAttachment';
import { isTypingIn } from './pierreDom';
import { replacementEdit } from './replacementEdit';

type CreateEditor = ComponentProps<typeof EditProvider>['createEditor'];

interface Attachment {
  /** The editor is attached to the diff (`attachesEditor`). */
  attached: boolean;
  /** Attaches it now, Pierre highlighting the diff on the main thread if it isn't yet (`MAX_WAIT_FOR_COLORS_MS`). */
  attach: () => void;
}

export interface PierreEditor {
  /** The editor holding the diff's modified text, once Pierre created it. */
  editor: RefObject<Editor | null>;
  /** The diff the editor attached to (not the whole-file editor's file). */
  fileDiff: RefObject<FileDiff<unknown, unknown> | null>;
  /** For `EditProvider`: creates the editors Pierre asks for, keeping the latest. */
  createEditor: CreateEditor;
  /**
   * Puts the caret at a place in the text. Before the editor is attached, once it is: what's typed meanwhile is kept
   * (`typeWhileAttaching`), and past `MAX_WAIT_FOR_COLORS_MS` it's attached anyway.
   */
  focusAt: (place: EditorFocusOptions | undefined) => void;
  /**
   * Keeps text typed at a place asked for (`focusAt`) until the editor is attached, to type it there then; whether it
   * was kept. Without an editor there's nothing to take the keys.
   */
  typeWhileAttaching: (text: string) => boolean;
}

/**
 * The editor Pierre creates for a diff typed into, held so the viewer acts on its text (discards, undo, focus) and
 * handed to the viewer as its `EditorHandle` (`editorRef`). An editor attaching later (`attachesEditor`) takes the caret
 * where it was asked for meanwhile, and the text typed there, once Pierre has attached it.
 */
export function usePierreEditor(editorRef: RefObject<EditorHandle | null> | undefined, containerRef: RefObject<HTMLElement | null>, attachment: Attachment): PierreEditor {
  const editor = useRef<Editor | null>(null);
  const fileDiff = useRef<FileDiff<unknown, unknown> | null>(null);
  const pendingFocus = useRef<{ place: EditorFocusOptions | undefined; typed: string; lateColors: ReturnType<typeof setTimeout> } | null>(null);
  const latestAttachment = useRef(attachment);
  latestAttachment.current = attachment;
  const [createEditor] = useState(() => {
    const create: CreateEditor = (type, options, key) => {
      const onAttach: typeof options.onAttach = (attached, surface) => {
        options.onAttach?.(attached, surface);
        fileDiff.current = surface instanceof FileDiff ? surface : null;
        const focus = pendingFocus.current;
        pendingFocus.current = null;
        if (focus) clearTimeout(focus.lateColors);
        if (focus) attached.focus(focus.place);
        if (focus?.typed) typeAt(attached as unknown as Editor, focus.place, focus.typed);
      };
      const created = new Editor(type, { ...options, onAttach }, key);
      editor.current = created as unknown as Editor;
      return created;
    };
    return create;
  });

  const [focusAt] = useState(() => (place: EditorFocusOptions | undefined) => {
    if (latestAttachment.current.attached && editor.current) return editor.current.focus(place);
    if (pendingFocus.current) clearTimeout(pendingFocus.current.lateColors);
    const lateColors = setTimeout(() => latestAttachment.current.attach(), MAX_WAIT_FOR_COLORS_MS);
    pendingFocus.current = { place, typed: pendingFocus.current?.typed ?? '', lateColors };
  });

  const [typeWhileAttaching] = useState(() => (text: string): boolean => {
    const pending = pendingFocus.current;
    if (!pending || typeof pending.place?.lineNumber !== 'number') return false;
    pending.typed += text;
    return true;
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
        const hadCaret = latestAttachment.current.attached && (editor.current?.getViewState().selections?.length ?? 0) > 0;
        focusAt(hadCaret ? undefined : { lineNumber: 'first-visible' });
      },
      hasFocus: () => isTypingIn(containerRef.current),
    }),
    [containerRef, focusAt],
  );

  return { editor, fileDiff, createEditor, focusAt, typeWhileAttaching };
}

/** Types `text` at a place (one-based line, as `focus` takes it) and leaves the caret after it. */
function typeAt(editor: Editor, place: EditorFocusOptions | undefined, text: string): void {
  if (typeof place?.lineNumber !== 'number') return;
  const at = { line: place.lineNumber - 1, character: place.character ?? 0 };
  const after = { line: at.line, character: at.character + text.length };
  editor.applyEdits([{ range: { start: at, end: at }, newText: text }]);
  editor.setSelections([{ start: after, end: after, direction: 'none' }]);
}
