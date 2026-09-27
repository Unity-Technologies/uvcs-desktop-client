/** The command line kept in the command log: past it, commands over thousands of paths show their start. */
export const MAX_LOGGED_COMMAND_LINE = 4000;
/** The output of a failed command kept in the command log. */
export const MAX_LOGGED_OUTPUT = 8000;

/**
 * Keeps the start of a text for the command log, which holds hundreds of entries for the whole session and sends each
 * to the window: an undo of 10,000 paths or a failed `cm find` printing everything would weigh megabytes.
 */
export function clipForLog(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}… ${(text.length - max).toLocaleString('en-US')} more characters`;
}
