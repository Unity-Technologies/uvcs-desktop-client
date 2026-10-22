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

/** Backspace in an empty field takes the last value away; with text in it, Backspace edits the text (null). */
export function afterBackspace(tokens: readonly string[], input: string): string[] | null {
  return input === '' && tokens.length > 0 ? tokens.slice(0, -1) : null;
}

/** The values without the one at `index` (its chip's ×). */
export function withoutToken(tokens: readonly string[], index: number): string[] {
  return tokens.filter((_token, at) => at !== index);
}
