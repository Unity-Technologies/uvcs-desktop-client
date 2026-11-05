import type { TextRange } from '../../lib/textMatchRanges';
import type { CommandLineToken, CommandLineTokenKind } from './commandLineTokens';

/** A run of a command line drawn one way: its color (`kind`) and whether the filter's words mark it. */
export interface CommandLineSegment {
  kind: CommandLineTokenKind;
  text: string;
  matched: boolean;
}

/**
 * The line cut where a token or a filter match (`wordMatchRanges`) starts or ends, so a match keeps the colors it spans
 * and a token is marked only where the filter matched it.
 */
export function commandLineSegments(line: string, tokens: readonly CommandLineToken[], matches: readonly TextRange[]): CommandLineSegment[] {
  const segments: CommandLineSegment[] = [];
  let match = 0;
  for (const token of tokens) {
    let cursor = token.start;
    while (cursor < token.end) {
      while (match < matches.length && matches[match]![1] <= cursor) match++;
      const next = matches[match];
      const matched = next !== undefined && next[0] <= cursor;
      const end = Math.min(token.end, next === undefined ? token.end : matched ? next[1] : next[0]);
      segments.push({ kind: token.kind, text: line.slice(cursor, end), matched });
      cursor = end;
    }
  }
  return segments;
}
