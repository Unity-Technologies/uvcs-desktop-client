/**
 * How many characters of `text` a call of its string method `name` read to answer `result`: a character for
 * `charCodeAt` and the like, what `slice` returns, how far `indexOf` looked, the whole text for any other method
 * (`split`, `replace`, `toLowerCase`...).
 */
export function charactersReadBy(name: string, text: string, args: unknown[], result: unknown): number {
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
