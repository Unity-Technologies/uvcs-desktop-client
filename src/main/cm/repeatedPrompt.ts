import { looksLikePrompt } from './consolePrompts';

/** The end of the output looked at: a loop shows once it is all one prompt, printed again and again. */
const WINDOW_BYTES = 4096;
/** Prompts are words: a shorter unit repeating is a rule line or padding (`----`), not a question. */
const MIN_PROMPT_BYTES = 8;
/** At least this many prompts fill the window, so a loop is told from a prompt that happens to show twice. */
const MAX_PROMPT_BYTES = WINDOW_BYTES / 4;
const LINE_FEED = 0x0a;
/** Progress rewritten in place: a line of its own, never a question asked again. */
const CARRIAGE_RETURN = 0x0d;
const REPLACEMENT_CHARACTER = '\uFFFD';

/**
 * Watches a command's stdout for `cm` asking the same question again and again: with its input closed (a process of its
 * own, `runCmProcess`), every answer it reads is empty, and some questions are asked again at once without a line break
 * (which system to sign in with). Such a loop never pauses, so the pause a `cm shell` session waits for
 * (`CmShellSession.watchForPrompt`) never comes: it is told instead by the end of the output being one prompt over and
 * over. Lines, records and progress always break lines (`\n`, or `\r` where progress is rewritten in place), so an
 * output with a line break in its last `WINDOW_BYTES` is no loop. Past that, any short unit repeated over the whole
 * window is taken for one (no real output prints the same few bytes 4 KB long without a line break); its rotation
 * that reads as a question only names it.
 *
 * Bytes, not text: only the window is kept, as a copy, so no chunk stays alive and nothing is decoded until a loop shows.
 */
export class RepeatedPromptWatch {
  private window = Buffer.alloc(0);
  private found: string | undefined;

  /** The prompt the output ends repeating, trimmed; undefined while it ends otherwise. */
  get prompt(): string | undefined {
    return this.found;
  }

  appendBytes(bytes: Buffer): void {
    this.window = Buffer.concat([this.window, bytes.subarray(-WINDOW_BYTES)]).subarray(-WINDOW_BYTES);
    this.found = repeatedPromptIn(this.window);
  }

  /** As `appendBytes`, for output already decoded (a process's text output). */
  appendText(text: string): void {
    this.appendBytes(Buffer.from(text.slice(-WINDOW_BYTES), 'utf8'));
  }
}

/** The prompt `window` is made of, repeated; undefined when it isn't full, breaks a line, or repeats no prompt. */
function repeatedPromptIn(window: Buffer): string | undefined {
  if (window.length < WINDOW_BYTES || window.includes(LINE_FEED) || window.includes(CARRIAGE_RETURN)) return undefined;
  const period = shortestPeriodOf(window);
  if (period === undefined || period < MIN_PROMPT_BYTES) return undefined;
  return promptRotationOf(window, period);
}

/** The shortest length the window's bytes repeat with, up to `MAX_PROMPT_BYTES`. */
function shortestPeriodOf(window: Buffer): number | undefined {
  const last = window.length - 1;
  for (let period = 1; period <= MAX_PROMPT_BYTES; period++) {
    if (window[last - period] !== window[last]) continue;
    if (window.subarray(period).equals(window.subarray(0, window.length - period))) return period;
  }
  return undefined;
}

/**
 * The repeated unit read from where the question starts: of its rotations, the one that cuts no character, starts with
 * no space and reads as a question ("Select your system [0-1] ", never " Select your system [0-1]" or
 * "ystem [0-1] S"). Bytes that aren't UTF-8 inside it are the console's code page (`cm` on Windows writes in it, but
 * for East Asian languages), kept as U+FFFD: only a rotation starting or ending inside a character is passed over.
 */
function promptRotationOf(window: Buffer, period: number): string | undefined {
  for (let shift = 0; shift < period; shift++) {
    const end = window.length - shift;
    if (isContinuationByte(window[end - period]!)) continue;
    const text = window.subarray(end - period, end).toString('utf8');
    if (text.startsWith(REPLACEMENT_CHARACTER) || text.endsWith(REPLACEMENT_CHARACTER) || /^\s/.test(text)) continue;
    const prompt = text.trimEnd();
    if (looksLikePrompt(prompt)) return prompt;
  }
  return undefined;
}

/** A byte inside a UTF-8 character of several, never one that starts a character. */
function isContinuationByte(byte: number): boolean {
  return (byte & 0xc0) === 0x80;
}
