/**
 * Questions `cm` asks on its console (typically credentials: which system to sign in with, a user, a password), which
 * the app never answers: a command that asks one is stopped (`CmShellSession`, `runCmProcess`).
 */

/** Longer last lines are output (e.g. `--format` records), not a question. */
export const MAX_PROMPT_LENGTH = 300;

/** A line that looks like a question, e.g. "Select your system [0-1]:"; XML output, which starts with `<`, never does. */
const PROMPT_LIKE_LINE = /^[^<].*(\[[^\]]*\]|[:?])\s*$/;

export function looksLikePrompt(line: string): boolean {
  return PROMPT_LIKE_LINE.test(line);
}

/** The failure of a command stopped as it waited for an answer to `prompt`. */
export function waitingForInputError(prompt: string): Error {
  return new Error(`cm is waiting for input ("${prompt.trim()}"). Check your credentials for this server.`);
}
