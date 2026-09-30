/**
 * How much text (both versions together) is diffed again at every keystroke. A diff takes about 7 ms a megabyte
 * (splitting, keying and patching every line, whatever changed): past this, the text typed into is diffed again once
 * typing pauses, as Pierre recolors the lines then anyway.
 */
export const MAX_DIFFED_PER_KEYSTROKE_CHARS = 1_000_000;

/** How long typing pauses before a big text typed into is diffed again. */
export const TYPING_PAUSE_MS = 300;

/** Whether a text typed into is diffed again at every keystroke, or once typing pauses. */
export function diffsEveryKeystroke(original: string, current: string): boolean {
  return original.length + current.length <= MAX_DIFFED_PER_KEYSTROKE_CHARS;
}

interface TypedTexts {
  original: string;
  /** The modified text as read. */
  saved: string | undefined;
  /** The modified text as it is now, with unsaved edits. */
  current: string;
  /** `current` as it was when typing last paused (`TYPING_PAUSE_MS`). */
  paused: string;
}

/**
 * The modified text the diff shown is of: the text as it is now, or while a big text is typed into, the text as it was
 * when typing last paused (`diffsEveryKeystroke`). Nothing typed, it's the text as read.
 */
export function diffedText({ original, saved, current, paused }: TypedTexts): string {
  return current === saved || diffsEveryKeystroke(original, current) ? current : paused;
}
