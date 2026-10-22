/**
 * Typing a list of short values (file types, names) as chips: spaces, commas and semicolons end a value, double quotes
 * keep them in one (`"Assets/Third Party/**"`). What the chips of `TokenField` do, decided here.
 */

const SEPARATOR = /[\s,;]/;

/** What typing has made of the field: the values it ended, and the one still being typed. */
export interface TypedTokens {
  tokens: string[];
  /** After the last separator, or from a quote not closed yet; kept in the field. */
  rest: string;
}

/** The values the text ends (each followed by a separator), and what's still being typed. */
export function typedTokens(text: string): TypedTokens {
  const tokens: string[] = [];
  let token = '';
  let quoted = false;
  let started = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (char === '"') quoted = !quoted;
    else if (!quoted && SEPARATOR.test(char)) {
      if (token) tokens.push(token);
      token = '';
      started = index + 1;
    } else token += char;
  }
  return { tokens, rest: text.slice(started) };
}

/**
 * Every value in the text, the last one too: what Enter, pasting or leaving the field adds. Text left inside a quote
 * that never closes (`ab"c`, `"Assets/Third Par`) is a value too, without its quotes: nothing typed is lost.
 */
export function allTokens(text: string): string[] {
  const { tokens, rest } = typedTokens(`${text} `);
  const unclosed = rest.replace(/"/g, '').trim();
  return unclosed ? [...tokens, unclosed] : tokens;
}

/** The values with the new ones after them, each once, in the order first given. */
export function addTokens(tokens: readonly string[], added: readonly string[]): string[] {
  return [...new Set([...tokens, ...added])];
}

/** Where the keyboard is in a token field: on a chip (its index), or in its input. */
export type TokenFocus = number | 'input';

/** What a key did: the values after it, and where the keyboard goes. */
export interface TokenKeyResult {
  tokens: string[];
  focus: TokenFocus;
}

/**
 * What a key does in a token field, or null when it's the input's own (typing, moving in its text). From an empty
 * input, Backspace takes the last chip away and ArrowLeft moves onto it; on a chip, ArrowLeft and ArrowRight move
 * between chips (past the last, back to the input), Backspace removes it and moves to the one before, Delete removes it
 * and stays where it was (the next one, or the input).
 */
export function tokenKey(key: string, focus: TokenFocus, tokens: readonly string[], input: string): TokenKeyResult | null {
  const last = tokens.length - 1;
  if (focus === 'input') {
    if (input !== '' || last < 0) return null;
    if (key === 'Backspace') return { tokens: tokens.slice(0, -1), focus: 'input' };
    if (key === 'ArrowLeft') return { tokens: [...tokens], focus: last };
    return null;
  }
  if (key === 'ArrowLeft') return { tokens: [...tokens], focus: Math.max(0, focus - 1) };
  if (key === 'ArrowRight') return { tokens: [...tokens], focus: focus < last ? focus + 1 : 'input' };
  if (key !== 'Backspace' && key !== 'Delete') return null;
  const remaining = withoutToken(tokens, focus);
  if (remaining.length === 0) return { tokens: remaining, focus: 'input' };
  if (key === 'Backspace') return { tokens: remaining, focus: Math.max(0, focus - 1) };
  return { tokens: remaining, focus: focus < remaining.length ? focus : 'input' };
}

/** The values without the one at `index` (its chip's ×). */
export function withoutToken(tokens: readonly string[], index: number): string[] {
  return tokens.filter((_token, at) => at !== index);
}
