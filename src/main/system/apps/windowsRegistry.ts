/**
 * Windows records of installed apps, read from the registry with `reg export` (`readInstalledApps`): one process per
 * key, and a file in UTF-16 that keeps every name intact, where `reg query` prints in the console's code page.
 */

/** Where installers register an app for "Apps & features", per user and per machine (64- and 32-bit). */
export const UNINSTALL_KEYS = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];

/** Where programs register the full path of their `.exe` (`pwsh.exe`, `powershell.exe`). */
export const APP_PATHS_KEYS = ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths', 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths'];

/** One key of an export: its full name and its string values (`@` is the default value). */
export interface RegistryKey {
  name: string;
  values: Record<string, string>;
}

/** An app as "Apps & features" lists it. */
export interface UninstallEntry {
  displayName: string;
  publisher: string;
  /** Its install folder, when the installer recorded it. */
  installLocation: string;
  /** Usually its main `.exe`, without the `,0` icon index or quotes. */
  displayIcon: string;
}

/**
 * The keys of a `.reg` export, with their text values: `REG_SZ` (`"name"="text"`) and `REG_EXPAND_SZ`
 * (`"name"=hex(2):…`, UTF-16 bytes, its `%VARIABLES%` expanded from `env`). Other kinds hold no path and are skipped.
 */
export function parseRegistryExport(text: string, env: NodeJS.ProcessEnv): RegistryKey[] {
  const keys: RegistryKey[] = [];
  let current: RegistryKey | null = null;
  for (const line of joinContinuedLines(text.replace(/^\uFEFF/, ''))) {
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      current = { name: header[1]!, values: {} };
      keys.push(current);
      continue;
    }
    const value = current && parseValue(line, env);
    if (value) current!.values[value.name] = value.text;
  }
  return keys;
}

/** Long `hex` values continue on the next line after a trailing `\`. */
function joinContinuedLines(text: string): string[] {
  const lines: string[] = [];
  let pending = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = pending ? pending + raw.trimStart() : raw;
    if (line.endsWith('\\') && /=hex/.test(line)) {
      pending = line.slice(0, -1);
      continue;
    }
    pending = '';
    lines.push(line);
  }
  return lines;
}

function parseValue(line: string, env: NodeJS.ProcessEnv): { name: string; text: string } | null {
  const match = /^(@|"(?:[^"\\]|\\.)*")=(.*)$/.exec(line);
  if (!match) return null;
  const name = match[1] === '@' ? '@' : unescape(match[1]!.slice(1, -1));
  const data = match[2]!;
  if (data.startsWith('"') && data.endsWith('"')) return { name, text: unescape(data.slice(1, -1)) };
  if (data.startsWith('hex(2):')) return { name, text: expandVariables(utf16FromHex(data.slice('hex(2):'.length)), env) };
  return null;
}

const unescape = (text: string): string => text.replace(/\\(.)/g, '$1');

function utf16FromHex(hex: string): string {
  const bytes = hex
    .split(',')
    .map((byte) => byte.trim())
    .filter(Boolean)
    .map((byte) => parseInt(byte, 16));
  return Buffer.from(bytes).toString('utf16le').replace(/\0+$/, '');
}

/** `%SystemRoot%\System32` with the variable's value; one that isn't set stays as written, as Windows leaves it. */
export function expandVariables(text: string, env: NodeJS.ProcessEnv): string {
  const lookup = new Map(Object.entries(env).map(([name, value]) => [name.toUpperCase(), value]));
  return text.replace(/%([^%]+)%/g, (whole, name: string) => lookup.get(name.toUpperCase()) ?? whole);
}

/** The apps listed in uninstall keys; keys without a display name aren't apps the user sees. */
export function uninstallEntries(keys: RegistryKey[]): UninstallEntry[] {
  return keys
    .filter((key) => key.values.DisplayName)
    .map(({ values }) => ({
      displayName: values.DisplayName!,
      publisher: values.Publisher ?? '',
      installLocation: unquote(values.InstallLocation ?? ''),
      displayIcon: unquote((values.DisplayIcon ?? '').replace(/,\s*-?\d+$/, '')),
    }));
}

/** The registered program paths by their lowercased `.exe` name (`pwsh.exe` → `C:\Program Files\PowerShell\7\pwsh.exe`). */
export function appPaths(keys: RegistryKey[]): Map<string, string> {
  return new Map(
    keys
      .filter((key) => key.values['@'])
      .map((key) => [key.name.split('\\').pop()!.toLowerCase(), unquote(key.values['@']!)] as const),
  );
}

const unquote = (text: string): string => text.trim().replace(/^"(.*)"$/, '$1');
