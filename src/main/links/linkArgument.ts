/**
 * The switch the OS's handler for `uvcs://` runs the app with, before the link: `"<exe>" --uvcs-link -- "%1"` (the
 * Windows installer, `setAsDefaultProtocolClient`, the Linux desktop entry). After `--`, Chromium reads no switch, so a
 * link can't slip one in.
 */
export const LINK_SWITCH = '--uvcs-link';

const LINK_START = /^uvcs:/i;

/**
 * The `uvcs://` link a launch of the app names, or null. Run as the scheme's handler (`--uvcs-link`), it is the first
 * argument after `--` and nothing else on the command line counts; a link given as any argument (a development run)
 * counts too.
 */
export function linkArgument(argv: readonly string[]): string | null {
  const args = argv.slice(1);
  if (args.includes(LINK_SWITCH)) {
    const separator = args.indexOf('--');
    return separator === -1 ? null : (args.slice(separator + 1).find((arg) => LINK_START.test(arg)) ?? null);
  }
  return args.find((arg) => /^uvcs:\/\//i.test(arg)) ?? null;
}

/** Whether a launch was run for a link: its command line then names nothing else, no folder included. */
export function isLinkLaunch(argv: readonly string[]): boolean {
  return argv.slice(1).includes(LINK_SWITCH) || linkArgument(argv) !== null;
}
