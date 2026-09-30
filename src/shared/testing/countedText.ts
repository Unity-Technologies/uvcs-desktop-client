import { charactersReadBy } from './charactersReadBy';

/**
 * Measures how much of a text code reads by counting characters, instead of timing it: the count is the same on any
 * machine under any load, so a test can bound the characters read per character of input and catch a parser that goes
 * back over the text (a pass per record reads the text as many times as it has records).
 *
 * `countedText(text)` gives a stand-in for `text` to hand the code under test. Each string method called on it counts
 * what it reads (`charactersReadBy`); any other use (a regular expression, joining it to another string) reads the
 * whole text.
 */
export function countedText(text: string): { text: string; charactersRead: () => number } {
  let read = 0;
  const reading = (count: number): void => void (read += count);
  const stringMethod = (name: string) => {
    const method = (String.prototype as unknown as Record<string, (...args: unknown[]) => unknown>)[name]!;
    return (...args: unknown[]): unknown => {
      const result = method.apply(text, args);
      reading(charactersReadBy(name, text, args, result));
      return result;
    };
  };
  const whole = (): string => {
    reading(text.length);
    return text;
  };

  const standIn = new Proxy(new String(text), {
    get(_target, property) {
      if (property === 'length') return text.length;
      if (property === Symbol.toPrimitive || property === 'toString' || property === 'valueOf') return whole;
      if (typeof property === 'symbol') throw new Error(`countedText can't count ${String(property)}`);
      if (/^\d+$/.test(property)) {
        reading(1);
        return text[Number(property)];
      }
      if (property in String.prototype) return stringMethod(property);
      throw new Error(`countedText can't count ${property}`);
    },
  });
  return { text: standIn as unknown as string, charactersRead: () => read };
}
