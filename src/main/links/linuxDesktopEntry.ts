import { LINK_SWITCH } from './linkArgument';

/** The key marking a desktop entry the app wrote itself: it rewrites only those, never a package's or another tool's. */
export const MANAGED_KEY = 'X-UVCS-Desktop-Managed';

/**
 * The desktop entry that makes an AppImage open `uvcs://` links (an AppImage registers nothing itself): the app at
 * `appImage`, run as the scheme's handler (`--uvcs-link -- %u`). Hidden from the desktop's menus (`NoDisplay`), which
 * stay the job of the user's AppImage integration, if any: it only names the handler. `%u` is empty when nothing opens
 * a link, and the launch is then the app's plain start.
 */
export function linuxDesktopEntry(appImage: string, name: string): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${name}`,
    `Exec=${execArgument(appImage)} ${LINK_SWITCH} -- %u`,
    'MimeType=x-scheme-handler/uvcs;',
    'NoDisplay=true',
    'Terminal=false',
    `${MANAGED_KEY}=true`,
    '',
  ].join('\n');
}

/** Whether the entry at the app's desktop file name is the app's to write: none yet, or one it wrote itself. */
export function mayWriteDesktopEntry(existing: string | null): boolean {
  return existing === null || existing.split(/\r?\n/).includes(`${MANAGED_KEY}=true`);
}

/**
 * An argument of a desktop entry's `Exec`, quoted as the Desktop Entry Specification says: double quotes around it,
 * a backslash before `"`, `` ` ``, `$` and `\` inside them, and `%` doubled, as `%` starts a field code.
 */
function execArgument(argument: string): string {
  return `"${argument.replace(/["`$\\]/g, '\\$&').replaceAll('%', '%%')}"`;
}
