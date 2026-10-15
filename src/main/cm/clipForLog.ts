/** The command line kept in the command log: past it, commands over thousands of paths show their start. */
export const MAX_LOGGED_COMMAND_LINE = 4000;
/** The output of a failed command kept in the command log, and sent with its error to the window. */
export const MAX_LOGGED_OUTPUT = 8000;

/**
 * Keeps the start of a text for the command log, which holds hundreds of entries for the whole session and sends each
 * to the window: an undo of 10,000 paths or a failed `cm find` printing everything would weigh megabytes. An output
 * keeps both `ends`: `cm` prints what went wrong last, after its progress, and the window reads it there
 * (`updateStoppedByConflicts`, `checkinRejection`).
 */
export function clipForLog(text: string, max: number, keep: 'start' | 'ends' = 'start'): string {
  if (text.length <= max) return text;
  const leftOut = `${(text.length - max).toLocaleString('en-US')} more characters`;
  if (keep === 'start') return `${text.slice(0, max)}… ${leftOut}`;
  const tail = Math.floor(max / 2);
  return `${text.slice(0, max - tail)}… ${leftOut} …${text.slice(text.length - tail)}`;
}
