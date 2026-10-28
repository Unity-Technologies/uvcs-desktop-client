import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { api } from '../../api/client';
import { isMac } from '../../lib/platform';
import { codeColors, codeTheme } from './codeColors';
import { commentMarkdown } from './commentLanguage';
import { closeCodeFence, FORMAT_COMMANDS, isInCode, linkFromPaste } from './formatCommands';
import { enterAction, modEnterAction, type FieldKeyAction } from './fieldKeys';
import { fieldLabelAttributes } from './fieldLabel';
import { formatForKey, pastesPlain } from './formattingKeys';
import { hasFocus, liveDrawing } from './liveDecorations';
import { tablesIn } from './tableModel';
import { verticalMoveInto } from './verticalMove';
import { compactChips, widgetPortals } from './liveWidgets';
import { markdownFromClipboard, pasteMarkdown } from './richPaste';
import { oneLine } from './oneLine';
import { ownStep } from './ownStep';
import { formatsOf } from './selectionBarState';
import { typingAt } from './typingAt';
import type { WidgetPortals } from './widgetPortals';

/** What the field does with the keys that leave the text: read when pressed, so the latest props answer. */
export interface CommentEditorKeys {
  /** One line: Enter (the summary's goes to the description); none submits the field's form, as an input does. */
  onEnter?: () => void;
  /** ⌘↵: none submits the field's form (a dialog), or leaves the key to the window (check in, merge). */
  onSubmit?: () => void;
}

export interface CommentEditorOptions {
  singleLine: boolean;
  label: string;
  labelledBy?: string;
  placeholder: string;
  portals: WidgetPortals;
  keys: { current: CommentEditorKeys };
}

/** Text the editor colors with the app's tokens (`LiveCommentEditor.module.css`): Markdown's own, around the caret. */
const markdownStyle = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-heading1' },
  { tag: tags.heading2, class: 'cm-heading2' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], class: 'cm-heading3' },
  { tag: tags.strong, class: 'cm-strong' },
  { tag: tags.emphasis, class: 'cm-emphasis' },
  { tag: tags.strikethrough, class: 'cm-strikethrough' },
  { tag: tags.monospace, class: 'cm-inlineCode' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator, tags.url], class: 'cm-markup' },
  { tag: tags.quote, class: 'cm-quote' },
]);

/** The parts of the editor the field changes while it shows: its being read-only, and the code's theme. */
export const editable = new Compartment();
export const theme = new Compartment();

export function editableWhen(enabled: boolean): Extension {
  return [EditorView.editable.of(enabled), EditorState.readOnly.of(!enabled)];
}

export function themed(name: string): Extension {
  return codeTheme.of(name);
}

/**
 * Everything a comment field's editor is (docs/features/rich-comments.md, "Writing"): Markdown drawn as it reads
 * around the caret, chips, Slack's keys, rich paste, undo. The decisions are the pure modules'; this wires them.
 */
export function commentEditorExtensions(options: CommentEditorOptions, enabled: boolean, codeThemeName: string): Extension {
  const formats = formatsOf(options.singleLine);
  return [
    history(),
    commentMarkdown(),
    syntaxHighlighting(markdownStyle),
    typingAt,
    options.singleLine ? oneLine : [],
    liveDrawing(),
    codeColors,
    widgetPortals.of(options.portals),
    compactChips.of(options.singleLine),
    editable.of(editableWhen(enabled)),
    theme.of(themed(codeThemeName)),
    EditorView.lineWrapping,
    EditorView.perLineTextDirection.of(true),
    placeholder(options.placeholder),
    EditorView.contentAttributes.of({ ...fieldLabelAttributes(options.label, options.labelledBy), 'aria-multiline': String(!options.singleLine), spellcheck: 'true' }),
    Prec.highest(
      keymap.of([
        { key: 'Mod-Enter', run: (view) => submit(view, options.keys.current) },
        { key: 'ArrowDown', run: (view) => moveIntoBlock(view, 1, false), shift: (view) => moveIntoBlock(view, 1, true) },
        { key: 'ArrowUp', run: (view) => moveIntoBlock(view, -1, false), shift: (view) => moveIntoBlock(view, -1, true) },
        { key: 'Enter', run: options.singleLine ? (view) => enterOnOneLine(view, options.keys.current) : closeCodeFence },
      ]),
    ),
    // ⌘↵ is the field's or the window's (check in, merge): never a blank line.
    keymap.of([...defaultKeymap.filter((binding) => binding.key !== 'Mod-Enter'), ...historyKeymap]),
    formattingKeys(formats),
    pasting(),
  ];
}

/**
 * ↓ or ↑ (with Shift, extending the selection) into a table drawn in place of its source (`verticalMoveInto`), where
 * the editor, moving by what it shows, would step over it. A move within a wrapped line stays the editor's.
 */
function moveIntoBlock(view: EditorView, direction: 1 | -1, extend: boolean): boolean {
  const range = view.state.selection.main;
  const own = view.moveVertically(range, direction === 1);
  if (view.state.doc.lineAt(own.head).number === view.state.doc.lineAt(range.head).number) return false;
  const target = verticalMoveInto(view.state, tablesIn(view.state, { revealsSelection: view.state.field(hasFocus) }), range.head, direction);
  if (target === null) return false;
  view.dispatch({ selection: extend ? { anchor: range.anchor, head: target } : { anchor: target }, scrollIntoView: true, userEvent: 'select' });
  return true;
}

function submit(view: EditorView, keys: CommentEditorKeys): boolean {
  return runFieldKey(view, modEnterAction({ singleLine: false, hasHandler: Boolean(keys.onSubmit), inForm: inForm(view) }), keys.onSubmit);
}

function enterOnOneLine(view: EditorView, keys: CommentEditorKeys): boolean {
  return runFieldKey(view, enterAction({ singleLine: true, hasHandler: Boolean(keys.onEnter), inForm: inForm(view) }), keys.onEnter);
}

function inForm(view: EditorView): boolean {
  return view.dom.closest('form') !== null;
}

/** Does what `fieldKeys` decided; false leaves the key to what comes after (the window, a new line). */
function runFieldKey(view: EditorView, action: FieldKeyAction, handler: (() => void) | undefined): boolean {
  switch (action) {
    case 'owner':
      handler?.();
      return true;
    case 'form':
      view.dom.closest('form')?.requestSubmit();
      return true;
    case 'nothing':
      return true;
    default:
      return false;
  }
}

/**
 * The registry's keys for each format the field offers (`formatForKey`), matched as the window's shortcuts are. A
 * format key does nothing in code, but it's still the field's: ⌘B there never opens New branch.
 */
function formattingKeys(formats: ReturnType<typeof formatsOf>): Extension {
  return Prec.high(
    EditorView.domEventHandlers({
      keydown: (event, view) => {
        plainPasteNext.delete(view);
        if (pastesPlain(event, isMac)) {
          // The page can't paste by itself, and no menu item takes ⇧⌘V (macOS's Paste and Match Style is ⌥⇧⌘V): the
          // window pastes the clipboard's text, the paste that follows marked as this key's.
          event.preventDefault();
          plainPasteNext.add(view);
          void api.windows.pasteClipboard({ plainText: true });
          return true;
        }
        const format = formatForKey(event, formats, isMac);
        if (!format) return false;
        event.preventDefault();
        FORMAT_COMMANDS[format](view);
        return true;
      },
    }),
  );
}

/** The views whose next paste is ⇧⌘V's: the clipboard's plain text, as typed. */
const plainPasteNext = new WeakSet<EditorView>();

/**
 * A paste: an address on selected text links it; HTML from a web page, Slack or a document as Markdown; code from an
 * editor as a code block. In code, after ⇧⌘V, or when the copy holds nothing rich, the plain text as it is.
 */
function pasting(): Extension {
  return EditorView.domEventHandlers({
    paste: (event, view) => {
      const plain = plainPasteNext.has(view);
      plainPasteNext.delete(view);
      const data = event.clipboardData;
      if (!data || plain) return false;
      const text = data.getData('text/plain');
      const link = linkFromPaste(view.state, text);
      if (link) {
        event.preventDefault();
        view.dispatch({ changes: link, selection: { anchor: link.from + link.insert.length }, userEvent: 'input.paste', annotations: ownStep, scrollIntoView: true });
        return true;
      }
      if (isInCode(view.state, view.state.selection.main.from)) return false;
      const markdown = markdownFromClipboard(data.getData('text/html'), text, editorLanguage(data.getData('vscode-editor-data')));
      if (!markdown) return false;
      event.preventDefault();
      view.dispatch(pasteMarkdown(view.state, markdown));
      return true;
    },
  });
}

/** The language VS Code says it copied (`{"mode": "typescript"}`). */
function editorLanguage(data: string): string | undefined {
  try {
    const mode: unknown = data ? (JSON.parse(data) as { mode?: unknown }).mode : undefined;
    return typeof mode === 'string' ? mode : undefined;
  } catch {
    return undefined;
  }
}
