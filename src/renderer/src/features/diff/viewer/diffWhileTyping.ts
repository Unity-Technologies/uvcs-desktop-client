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
