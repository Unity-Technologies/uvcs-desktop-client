import { charactersReadBy } from './charactersReadBy';

/**
 * How many characters the string methods called while `run` runs read, on any string: the input and every piece cut
 * from it. A measure of a parser's work that is the same on any machine under any load, unlike the time it takes: a
 * test bounds it per character of input, which a parser going back over the text (a pass per record) exceeds by far.
 *
 * Each call counts what it reads (`charactersReadBy`). The methods of `String.prototype` are wrapped for the run only.
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
