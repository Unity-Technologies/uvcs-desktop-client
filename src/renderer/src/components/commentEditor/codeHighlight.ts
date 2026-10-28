import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { fenceLanguage } from '../comments/codeBlockLanguage';
import { codeTokenStyle, type ColoredToken } from '../comments/codeTokenStyle';

/** A code block's code and the language its fence names, which the comments' highlighter colors. */
export interface FencedCode {
  /** Where the code starts, after the opening fence's line. */
  from: number;
  text: string;
  language: string;
}

/** The code blocks with a language in `[from, to]`, as the shown comment highlights them (`CodeBlock`). */
export function fencedCodeIn(state: EditorState, from = 0, to = state.doc.length): FencedCode[] {
  const blocks: FencedCode[] = [];
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (node.name !== 'FencedCode') return;
      const info = node.node.getChild('CodeInfo');
      const code = node.node.getChild('CodeText');
      const language = fenceLanguage(info ? state.sliceDoc(info.from, info.to) : undefined);
      if (language && code) blocks.push({ from: code.from, text: state.sliceDoc(code.from, code.to), language });
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
