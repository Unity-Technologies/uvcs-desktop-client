import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isInCode } from './formatCommands';

/** What a suggestion list offers: the objects a comment names, people and emoji. */
export type SuggestionKind = 'changeset' | 'branch' | 'label' | 'shelve' | 'codeReview' | 'person' | 'emoji';

/** What is being typed at the caret that a suggestion list completes. */
export interface SuggestionQuery {
  kind: SuggestionKind;
  /** Where the trigger (`cs:`, `@`, `:`) starts: what a pick replaces from, and where the list opens. */
  from: number;
  /** Where the word being typed ends, past the caret when it's in the middle: what a pick replaces to. */
  to: number;
  /** What was typed after the trigger, up to the caret. */
  text: string;
}

const TRIGGERS: Record<string, SuggestionKind> = {
  'cs:': 'changeset',
  'br:': 'branch',
  'lb:': 'label',
  'sh:': 'shelve',
  'cr:': 'codeReview',
  '@': 'person',
  ':': 'emoji',
};

/**
 * A trigger where a reference may start (`findReferences`): after a space, a line's start, an opening bracket or an
 * emphasis mark, never inside a word, a path or an address (`ana@acme.com`, `/a/cs:1`, `10:30`, `Note:`), then the
 * word typed so far.
 */
const TYPED = /(?<![\p{L}\p{N}/@:.#\\-])(cs:|br:|lb:|sh:|cr:|@|:)(\S*)$/u;

/** An emoji's name as typed: GitHub's list opens after two letters, so a colon in a sentence opens nothing. */
const EMOJI_NAME = /^[a-z0-9_+-]{2,}$/;

/** What a person's name may hold as typed, as `cm` names owners (`DOMAIN\name`, an email address). */
const PERSON_NAME = /^[\p{L}\p{N}_.+\\@-]*$/u;

/** The suggestion list to show for the caret, or null for none: a selection, code, or no trigger before the caret. */
export function suggestionQueryAt(state: EditorState): SuggestionQuery | null {
  const main = state.selection.main;
  if (!main.empty || state.selection.ranges.length > 1) return null;
  const line = state.doc.lineAt(main.head);
  const match = TYPED.exec(line.text.slice(0, main.head - line.from));
  if (!match) return null;
  const [, trigger = '', text = ''] = match;
  const kind = TRIGGERS[trigger]!;
  if (kind === 'emoji' && !EMOJI_NAME.test(text)) return null;
  if (kind === 'person' && !PERSON_NAME.test(text)) return null;
  const from = line.from + match.index;
  if (isInCode(state, from + 1) || isInAddress(state, from + 1)) return null;
  const rest = /^\S*/.exec(line.text.slice(main.head - line.from))![0];
  return { kind, from, to: main.head + rest.length, text };
}

/** Inside a web address (`https://ci.acme.com/job?b=br:`) or a link's, where a reference is never read. */
function isInAddress(state: EditorState, pos: number): boolean {
  for (let node = syntaxTree(state).resolveInner(pos, -1); node.parent; node = node.parent) {
    if (node.name === 'URL' && /^(?:[a-z][a-z0-9+.-]*:\/\/|www\.)/i.test(state.sliceDoc(node.from, node.to))) return true;
  }
  return false;
}
