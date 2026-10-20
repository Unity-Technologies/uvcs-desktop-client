import { escapeRegExp } from '@shared/escapeRegExp';
import { withoutUrlUserInfo } from '@shared/urlUserInfo';

/** What a hidden secret shows as in the command log, errors and console warnings. */
const HIDDEN_SECRET = '•••';

/** Options whose value is a secret (`cm sync ... git --pwd=`). Add any new one the app passes. */
const SECRET_OPTIONS = ['--pwd='];


/**
 * The command line as the command log, a `CmError` and the `[server budget]` warning show it: every command is logged
 * and sent to the window, so a password passed to `cm` must never reach them.
 */
export function commandLineForLog(args: readonly string[]): string {
  return `cm ${args.map(hideSecretArgument).join(' ')}`;
}

/**
 * A failed command's output, which may echo back the URL it was given: a URL's whole user info is hidden
 * (`https://•••@github.com/…`), as a Git URL pasted with a token carries it as the user alone or after one.
 */
export function outputForLog(output: string): string {
  return withoutUrlUserInfo(output, `${HIDDEN_SECRET}@`);
}

/**
 * Any text that may quote a command line or echo a URL, such as an error nothing caught (its message and stack): a
 * secret option's value is hidden up to the next space, as a command line prints it.
 */
export function textForLog(text: string): string {
  return SECRET_OPTIONS.reduce((hidden, option) => hidden.replace(new RegExp(`${escapeRegExp(option)}\\S*`, 'g'), `${option}${HIDDEN_SECRET}`), outputForLog(text));
}

function hideSecretArgument(arg: string): string {
  const option = SECRET_OPTIONS.find((prefix) => arg.startsWith(prefix));
  if (option) return `${option}${HIDDEN_SECRET}`;
  return outputForLog(arg);
}
