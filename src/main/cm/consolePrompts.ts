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

/**
 * The failure of a command stopped as it waited for an answer to `prompt`: almost always a sign-in `cm` lacks, which
 * `CmClient` tells as one (`CmSignInError`) once it knows the command's server.
 */
export class WaitingForInputError extends Error {
  constructor(readonly prompt: string) {
    super(waitingForInputMessage(prompt));
    this.name = 'WaitingForInputError';
  }
}

const WAITING_FOR_INPUT = /^cm is waiting for input \("(.*)"\)\. Check your credentials for this server\.$/m;

function waitingForInputMessage(prompt: string): string {
  return `cm is waiting for input ("${prompt.trim()}"). Check your credentials for this server.`;
}

/** The prompt a command was stopped at, from the output its failure logged (`WaitingForInputError`); undefined if none. */
export function promptOfWaitingFailure(output: string): string | undefined {
  return WAITING_FOR_INPUT.exec(output)?.[1];
}
