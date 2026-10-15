/**
 * The text as a string of its own. Parsed values are slices of the command's whole output, which V8 keeps alive for
 * as long as any slice lives: a cache keeping a few names of a 20 MB listing keeps all 20 MB. What a cache keeps
 * longer than the command's answer is used is copied at the cache, not in every parser.
 */
export function ownCopy(text: string): string {
  return Buffer.from(text, 'utf8').toString('utf8');
}

