import type { CSSProperties } from 'react';

/** A highlighted token as the highlighter colors it: its color, and its font style as Shiki's bit flags. */
export interface ColoredToken {
  color?: string;
  fontStyle?: number;
}

// Shiki's `FontStyle` flags.
const ITALIC = 1;
const BOLD = 2;
const UNDERLINE = 4;

/** How a token of a comment's code block is drawn: the theme's color, italic, bold or underlined as it says. */
export function codeTokenStyle(token: ColoredToken): CSSProperties {
  const style: CSSProperties = {};
  if (token.color) style.color = token.color;
  const flags = token.fontStyle ?? 0;
  if (flags & ITALIC) style.fontStyle = 'italic';
  if (flags & BOLD) style.fontWeight = 'bold';
  if (flags & UNDERLINE) style.textDecoration = 'underline';
  return style;
}

/**
 * The language a fence names, as the highlighter looks it up: lower case, its own names and aliases (`csharp`,
 * `cs`, `c#`). Null for none, where the block stays plain.
 */
export function fenceLanguage(info: string | undefined): string | null {
  const name = info?.trim().split(/\s+/)[0]?.toLowerCase();
  return name ? name : null;
}
