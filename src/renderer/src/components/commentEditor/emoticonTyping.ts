import { undo } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import { Prec, StateEffect, StateField, type EditorState, type Extension, type StateCommand, type TransactionSpec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { emoticonEnding, endsEmoticon, insideOpenCodeSpan, isTableDelimiterRow } from './emoticons';
import { isInCode } from './formatCommands';
import { ownStep } from './ownStep';

/** An emoticon just turned into its emoji (`emoticonReplacement`). */
const emoticonReplaced = StateEffect.define<null>();

/**
 * Whether the last thing that happened was an emoticon turned into its emoji: Backspace then brings the emoticon back
 * (`revertEmoticon`). Forgotten at the next edit or caret move, after which Backspace deletes as always.
 */
export const justReplacedEmoticon = StateField.define<boolean>({
  create: () => false,
  update: (replaced, transaction) => {
    if (transaction.effects.some((effect) => effect.is(emoticonReplaced))) return true;
    return transaction.docChanged || transaction.selection ? false : replaced;
  },
});

/** Where an emoticon is text a comment means as written, never an emoji: a link, an image, a web address. */
const LINKS = new Set(['Link', 'Image', 'URL', 'Autolink']);

/**
 * The change that turns the emoticon ending at `end` into its emoji (docs/features/rich-comments.md, "Emoticons"), or
 * null when there's none there or it's written where text means what it says: code (a block, a span, or a span still
 * being typed), a link or an address, a table's alignment row. A step of its own in the history, so undo brings the
 * emoticon back.
 */
export function emoticonReplacement(state: EditorState, end: number): TransactionSpec | null {
  if (state.selection.ranges.length > 1) return null;
  const line = state.doc.lineAt(end);
  const before = line.text.slice(0, end - line.from);
  const found = emoticonEnding(before);
  if (!found || insideOpenCodeSpan(before.slice(0, found.from))) return null;
  if (isTableDelimiterRow(line.text, line.number > 1 ? state.doc.line(line.number - 1).text : null)) return null;
  const from = line.from + found.from;
  if (isInCode(state, from + 1) || isInLink(state, from + 1)) return null;
  return {
    changes: { from, to: end, insert: found.emoji },
    effects: emoticonReplaced.of(null),
    userEvent: 'input.emoticon',
    annotations: ownStep,
  };
}

/** After `typed` was typed at `typedAt`: the emoticon it ends turned into its emoji, or null. */
export function emoticonAfterTyping(state: EditorState, typedAt: number, typed: string): TransactionSpec | null {
  return endsEmoticon(typed) ? emoticonReplacement(state, typedAt) : null;
}

/** Before Enter starts a line: the emoticon before the caret turned into its emoji, or null. */
export function emoticonBeforeLineBreak(state: EditorState): TransactionSpec | null {
  const main = state.selection.main;
  return main.empty ? emoticonReplacement(state, main.head) : null;
}

/**
 * Backspace right after an emoticon became its emoji: undo, which brings the emoticon back as typed, for someone who
 * meant the characters. Anywhere else, false: Backspace deletes as always.
 */
export const revertEmoticon: StateCommand = (target) => (target.state.field(justReplacedEmoticon, false) ? undo(target) : false);

/**
 * Emoticons typed in a comment field become their emoji, as in Slack: after a space or a sentence's punctuation
 * typed, and Enter in a field of many lines (a one-line field's Enter leaves it). Only what is typed: a paste never
 * reaches `inputHandler`, nor does a text composed with an input method until it's done.
 */
export function emoticonTyping(singleLine: boolean): Extension {
  return [
    justReplacedEmoticon,
    EditorView.inputHandler.of((view, from, _to, text, insert) => {
      if (view.composing || !endsEmoticon(text)) return false;
      view.dispatch(insert());
      const replacement = emoticonAfterTyping(view.state, from, text);
      if (replacement) view.dispatch(replacement);
      return true;
    }),
    Prec.highest(
      keymap.of([
        { key: 'Backspace', run: revertEmoticon },
        ...(singleLine ? [] : [{ key: 'Enter', run: replaceBeforeLineBreak }]),
      ]),
    ),
  ];
}

/** Turns the emoticon into its emoji and leaves Enter to the keys after it (a list's next item, a plain line). */
function replaceBeforeLineBreak(view: EditorView): boolean {
  const replacement = emoticonBeforeLineBreak(view.state);
  if (replacement) view.dispatch(replacement);
  return false;
}

function isInLink(state: EditorState, pos: number): boolean {
  for (let node = syntaxTree(state).resolveInner(pos, -1); node.parent; node = node.parent) if (LINKS.has(node.name)) return true;
  return false;
}
