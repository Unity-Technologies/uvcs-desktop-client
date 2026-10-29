import type { CustomEditor } from '@shared/domain/externalApps';

/**
 * The official Desktop client's "Open with" programs, one a line in `openwith.conf`: `[<name>|<shortcut>] "<program>"
 * <arguments>`. Each becomes an app the user added. Its shortcut isn't kept (every shortcut is the app's own,
 * `shortcutRegistry`), nor its arguments, which that client never passed: it opened the file alone. It shows no line
 * without arguments; one is read here all the same, as the user meant it. Read once, by `importLegacySettings`.
 */
export function readLegacyOpenWith(conf: string): Omit<CustomEditor, 'id'>[] {
  return conf.split(/\r\n|\r|\n/).flatMap((line) => {
    const match = /^\s*\[([^\]]*)\]\s*"([^"]*)"/.exec(line);
    const name = match?.[1]?.split('|')[0]?.trim();
    const executable = match?.[2]?.trim();
    return name && executable ? [{ name, executable }] : [];
  });
}
