/**
 * A source's code without its comments: what a static test reads to find what the code does, not what its comments
 * explain. Strings are kept whole, so a `//` in one stays; a `'` or `"` ends at its line's end, so an apostrophe in JSX
 * text costs at most that line. A regular expression holding `/*` would open a comment (none does today).
 */
export function withoutComments(source: string): string {
  const pieces: string[] = [];
  const opening = /\/\/|\/\*|['"`]/g;
  let index = 0;
  for (let match = opening.exec(source); match; match = opening.exec(source)) {
    pieces.push(source.slice(index, match.index));
    if (match[0] === '//') index = endOf(source, '\n', match.index);
    else if (match[0] === '/*') index = endOf(source, '*/', match.index + 2) + 2;
    else {
      index = quotedEnd(source, match.index);
      pieces.push(source.slice(match.index, index));
    }
    opening.lastIndex = index;
  }
  pieces.push(source.slice(index));
  return pieces.join('');
}

/**
 * The text of every string, template and regular expression literal in `source`, comments left out. An escaped
 * punctuation mark reads as itself (`\.` as `.`, `\\` as `\`); an escaped letter or digit (`\b`, `\s`, `\n`) as a
 * space, since it stands for no text of its own. A template is one literal, its `${...}` included. A `/` followed by
 * no space starts a regular expression up to the next `/` on its line: a JSX closing tag read that way only adds a
 * literal, never hides one.
 */
export function literalsOf(source: string): string[] {
  return [...withoutComments(source).matchAll(LITERAL)].map(([literal]) => unescaped(literal.slice(1, -1)));
}

const LITERAL = /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`|\/(?![*/\s])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+\//g;

function unescaped(text: string): string {
  return text.replace(/\\(.)/g, (_, char: string) => (/[A-Za-z0-9]/.test(char) ? ' ' : char));
}

function endOf(source: string, text: string, from: number): number {
  const index = source.indexOf(text, from);
  return index === -1 ? source.length : index;
}

/** Where the string or template opened at `open` ends, past its closing quote. */
function quotedEnd(source: string, open: number): number {
  const quote = source[open];
  for (let index = open + 1; index < source.length; index++) {
    const char = source[index];
    if (char === '\\') index++;
    else if (char === quote) return index + 1;
    else if (char === '\n' && quote !== '`') return index;
  }
  return source.length;
}
