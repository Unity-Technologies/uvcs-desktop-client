import type { CmOutputKind } from './commandOutputs';

/**
 * The most characters of a command's text output that are kept (`TextLimit`). Text is what answers (`whoami`, a
 * workspace's header, an item's details: a few KB) and operations print; every list is streamed (`cmOutputKind`), so
 * no text gets near it but a write's line per item, of which only the ends are kept.
 */
export const MAX_TEXT_OUTPUT_LENGTH = 4 * 1024 * 1024;

const MEGABYTE = 1024 * 1024;

/**
 * How much of a command's text output is kept: all of it up to `maxLength`; past it an answer is stopped (`stop`), since
 * its caller needs all of it, and an operation keeps its start and end (`keepEnds`, half each), where `cm` prints what
 * it did and what went wrong, and goes on.
 */
export interface TextLimit {
  maxLength: number;
  past: 'stop' | 'keepEnds';
}

/** The limit of an answer's or an operation's text (`textOutputKind`). */
export function textLimitOf(kind: Exclude<CmOutputKind, 'list'>, maxLength = MAX_TEXT_OUTPUT_LENGTH): TextLimit {
  return { maxLength, past: kind === 'answer' ? 'stop' : 'keepEnds' };
}

/** An answer's limit: what a runner keeps of a command it's given no limit for. */
export const ANSWER_TEXT: TextLimit = textLimitOf('answer');

/**
 * An answer printed more than `MAX_TEXT_OUTPUT_LENGTH`, so it was stopped. `CmClient` reports it as a `CmError`, which
 * names the command.
 */
export class CmOutputTooLargeError extends Error {
  constructor(maxLength: number) {
    super(`The command printed more than ${describeLength(maxLength)}, too much to read, and was stopped.`);
    this.name = 'CmOutputTooLargeError';
  }
}

function describeLength(length: number): string {
  return length >= MEGABYTE ? `${Math.round(length / MEGABYTE)} MB` : `${length} characters`;
}

/** The marker put where the middle of an operation's output was left out (`keepEnds`). */
export function leftOutMarker(characters: number): string {
  return `\n… ${characters.toLocaleString('en-US')} more characters …\n`;
}
