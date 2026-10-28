import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { highlightedLanguage } from '../comments/codeBlockLanguage';
import { codeTokenStyle, type ColoredToken } from '../comments/codeTokenStyle';

/** A code block's code and the language its fence names, which the comments' highlighter colors. */
export interface FencedCode {
  /** Where the code starts, after the opening fence's line. */
  from: number;
  text: string;
  language: string;
}

/** The code blocks with a language in `[from, to]` small enough to highlight, as the shown comment does (`CodeBlock`). */
export function fencedCodeIn(state: EditorState, from = 0, to = state.doc.length): FencedCode[] {
  const blocks: FencedCode[] = [];
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (node.name !== 'FencedCode') return;
      const info = node.node.getChild('CodeInfo');
      const code = node.node.getChild('CodeText');
      if (!code) return false;
      // A block past the comments' limit (a pasted log) stays plain, as the shown comment leaves it (`highlightedLanguage`).
      const text = state.sliceDoc(code.from, code.to);
      const language = highlightedLanguage(text, info ? state.sliceDoc(info.from, info.to) : undefined);
      if (language) blocks.push({ from: code.from, text, language });
      return false;
    },
  });
  return blocks;
}

/** A colored run of a code block, as a style to draw it with. */
export interface TokenMark {
  from: number;
  to: number;
  style: string;
}

/**
 * The highlighter's tokens (a list per line of the code) as runs of the text from `codeFrom`, the code's lines one
 * line end apart. Tokens with no color of their own are left as the code's text.
 */
export function tokenMarks(codeFrom: number, lines: readonly (readonly (ColoredToken & { content: string })[])[]): TokenMark[] {
  const marks: TokenMark[] = [];
  let at = codeFrom;
  for (const line of lines) {
    for (const token of line) {
      const style = cssText(codeTokenStyle(token));
      if (style && token.content) marks.push({ from: at, to: at + token.content.length, style });
      at += token.content.length;
    }
    at += 1;
  }
  return marks;
}

function cssText(style: ReturnType<typeof codeTokenStyle>): string {
  return Object.entries(style)
    .map(([property, value]) => `${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${String(value)}`)
    .join('; ');
}

/** How long the text stays unchanged before colors that arrived redraw it (`codeColors`). */
export const TYPING_PAUSE_MS = 200;

/**
 * How long colors that arrived wait before they redraw the code: none after a pause in typing, the rest of the pause
 * while typing. Redrawing a line as a key lands there, the first time a grammar loaded, put a key typed fast at the
 * text's end (seen on screen in a development build; no test reaches the editor's input, so the cause isn't pinned:
 * waiting for a pause is what made it go away).
 */
export function colorArrivalDelay(now: number, typedAt: number): number {
  return Math.max(0, TYPING_PAUSE_MS - (now - typedAt));
}
