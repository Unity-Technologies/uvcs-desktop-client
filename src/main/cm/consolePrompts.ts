import type { FailedCommand } from '@shared/ipc';
import { CmError } from './CmError';

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

function waitingForInputMessage(prompt: string): string {
  return `cm is waiting for input ("${prompt.trim()}"). Check your credentials for this server.`;
}

/** A command stopped at a prompt, reported as any failed command, with the prompt it waited at (`WaitingForInputError`). */
export class CmStoppedAtPromptError extends CmError {
  constructor(
    readonly prompt: string,
    command: FailedCommand,
  ) {
    super(waitingForInputMessage(prompt), command);
    this.name = 'CmStoppedAtPromptError';
  }
}
