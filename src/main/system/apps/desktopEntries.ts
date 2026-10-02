import { posix } from 'node:path';
import type { AppFileSystem } from './appFileSystem';
import { findOnPath } from './findProgram';
import type { Whereabouts } from './whereabouts';

/**
 * Linux desktop entries (freedesktop.org's Desktop Entry spec): every app installed for the desktop, from a package,
 * a Flatpak or a Snap, has a `<id>.desktop` file telling how to run it, the Linux counterpart of a macOS bundle
 * identifier or a Windows uninstall entry.
 */

/**
 * The folders desktop entries are looked up in, the first one winning: the user's (`$XDG_DATA_HOME`), the system's
 * (`$XDG_DATA_DIRS`), then the Flatpak and Snap exports, in case the session didn't add them to `$XDG_DATA_DIRS`.
 */
export function applicationFolders(where: Whereabouts): string[] {
  const dataHome = where.env.XDG_DATA_HOME || posix.join(where.home, '.local/share');
  const dataDirs = (where.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':').filter(Boolean);
  const exports = [posix.join(where.home, '.local/share/flatpak/exports/share'), '/var/lib/flatpak/exports/share', '/var/lib/snapd/desktop'];
  return [...new Set([dataHome, ...dataDirs, ...exports].map((folder) => posix.join(folder, 'applications')))];
}

/** How an installed app runs: its `Exec` command line, split into arguments, its field codes still in. */
export interface DesktopEntry {
  file: string;
  exec: string[];
}

/** The first of these desktop entries installed and runnable here; hidden ones and those whose program is gone don't count. */
export function findDesktopEntry(desktopIds: string[], where: Whereabouts, fs: AppFileSystem): DesktopEntry | undefined {
  const folders = applicationFolders(where);
  for (const id of desktopIds) {
    for (const folder of folders) {
      const file = posix.join(folder, id);
      const text = fs.read(file);
      if (text === null) continue;
      // The first file with an id decides, even hidden: that is how a user hides a system entry.
      const entry = parseDesktopEntry(text);
      if (entry && isRunnable(entry, where, fs)) return { file, exec: entry.exec };
      break;
    }
  }
  return undefined;
}

interface ParsedEntry {
  exec: string[];
  tryExec?: string;
}

/** The `[Desktop Entry]` group's command line; null for entries that are hidden, not applications, or run nothing. */
export function parseDesktopEntry(text: string): ParsedEntry | null {
  const keys = new Map<string, string>();
  let inMainGroup = false;
  for (const line of text.split(/\r?\n/)) {
    const group = /^\[(.+)\]\s*$/.exec(line);
    if (group) {
      inMainGroup = group[1] === 'Desktop Entry';
      continue;
    }
    const pair = /^([A-Za-z0-9-]+)\s*=\s*(.*)$/.exec(line);
    if (inMainGroup && pair && !keys.has(pair[1]!)) keys.set(pair[1]!, pair[2]!);
  }
  if (keys.get('Hidden') === 'true' || (keys.get('Type') ?? 'Application') !== 'Application') return null;
  const exec = splitExec(keys.get('Exec') ?? '');
  if (exec.length === 0) return null;
  return { exec, ...(keys.get('TryExec') && { tryExec: unescapeString(keys.get('TryExec')!) }) };
}

function isRunnable(entry: ParsedEntry, where: Whereabouts, fs: AppFileSystem): boolean {
  return [entry.tryExec, entry.exec[0]].every((program) => program === undefined || programExists(program, where, fs));
}

function programExists(program: string, where: Whereabouts, fs: AppFileSystem): boolean {
  return program.startsWith('/') ? fs.exists(program) : findOnPath([program], where, fs) !== undefined;
}

/** A string value's escapes (`\s`, `\n`, `\t`, `\r`, `\\`), undone before the command line is split. */
function unescapeString(value: string): string {
  return value.replace(/\\([sntr\\])/g, (_whole, code: string) => ({ s: ' ', n: '\n', t: '\t', r: '\r', '\\': '\\' })[code]!);
}

/**
 * `Exec` split into arguments: spaces separate them, double quotes group them, and inside quotes a backslash escapes
 * `"`, `` ` ``, `$` and `\` (the spec's quoting rules).
 */
export function splitExec(value: string): string[] {
  const text = unescapeString(value);
  const args: string[] = [];
  let current = '';
  let quoted = false;
  let started = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted && char === '\\' && index + 1 < text.length) {
      current += text[++index];
    } else if (char === '"') {
      quoted = !quoted;
      started = true;
    } else if (!quoted && /\s/.test(char)) {
      if (started) args.push(current);
      current = '';
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (started) args.push(current);
  return args;
}

/**
 * The command line opening `path`: the file codes (`%f %F %u %U`) become the path, the others are dropped, and an
 * entry that takes no file gets it at the end. `%%` is a percent sign.
 */
export function execArgsFor(exec: string[], path: string): string[] {
  let placed = false;
  const args = exec.flatMap((arg) => {
    if (/^%[fFuU]$/.test(arg)) {
      placed = true;
      return [path];
    }
    if (/^%[a-zA-Z]$/.test(arg)) return [];
    return [arg.replace(/%[fFuU]/g, () => ((placed = true), path)).replace(/%[a-zA-Z]/g, '').replaceAll('%%', '%')];
  });
  return placed ? args : [...args, path];
}
