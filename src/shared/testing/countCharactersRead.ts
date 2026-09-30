/**
 * How many characters the string methods called while `run` runs read, on any string: the input and every piece cut
 * from it. A measure of a parser's work that is the same on any machine under any load, unlike the time it takes: a
 * test bounds it per character of input, which a parser going back over the text (a pass per record) exceeds by far.
 *
 * Each call counts what it reads: a character for `charCodeAt` and the like, what `slice` returns, how far `indexOf`
 * looked, the whole string for any other method (`split`, `replace`, `toLowerCase`...). The methods of
 * `String.prototype` are wrapped for the run only.
 */
export function countCharactersRead<T>(run: () => T): { result: T; charactersRead: number } {
  let read = 0;
  const prototype = String.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
  const originals = STRING_METHODS.map((name) => [name, prototype[name]!] as const);
  for (const [name, method] of originals) {
    prototype[name] = function (this: string, ...args: unknown[]) {
      const result = method.apply(this, args);
      read += charactersReadBy(name, this, args, result);
      return result;
    };
  }
  try {
    const result = run();
    return { result, charactersRead: read };
  } finally {
    for (const [name, method] of originals) prototype[name] = method;
  }
}

const STRING_METHODS = Object.getOwnPropertyNames(String.prototype).filter(
  (name) => name !== 'constructor' && typeof (String.prototype as unknown as Record<string, unknown>)[name] === 'function',
);

/** How many characters of `text` a call of its method `name` read to answer `result`. */
function charactersReadBy(name: string, text: string, args: unknown[], result: unknown): number {
  switch (name) {
    case 'at':
    case 'charAt':
    case 'charCodeAt':
    case 'codePointAt':
      return 1;
    case 'slice':
    case 'substring':
    case 'substr':
      return (result as string).length;
    case 'startsWith':
    case 'endsWith':
      return String(args[0]).length;
    case 'indexOf': {
      const from = Math.max(0, Number(args[1] ?? 0));
      const found = result as number;
      return found < 0 ? text.length - from : found - from + String(args[0]).length;
    }
    default:
      return text.length;
  }
}
