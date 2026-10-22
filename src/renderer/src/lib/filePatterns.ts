/**
 * File patterns as people type them to name a kind of file: an extension (`.cs`), a wildcard name (`*.prefab`,
 * `Level?.unity`) or a path (`Assets/Data/**`). A pattern without `/` matches the file's name, wherever it is; one with
 * `/` matches the path from the workspace's root. `*` and `?` stay within a folder; `**` crosses folders.
 */

/** The patterns typed in one field, separated by spaces, commas or semicolons (as the official client wrote them). */
export function parseFilePatterns(text: string): string[] {
  return text.split(/[\s,;]+/).filter((pattern) => pattern !== '');
}

/** The patterns as one field shows them. */
export function formatFilePatterns(patterns: readonly string[]): string {
  return patterns.join(' ');
}

/** File names differ only in case on Linux; Windows and macOS (by default) treat `A.cs` and `a.cs` as one file. */
export function fileNamesIgnoreCase(platform: string): boolean {
  return platform !== 'linux';
}

/** Whether the file at `path` (from the workspace's root, `/` between folders) matches the pattern. */
export function matchesFilePattern(pattern: string, path: string, ignoreCase: boolean): boolean {
  const relativePath = path.replace(/\\/g, '/').replace(/^\/+/, '');
  const wildcard = pattern.replace(/\\/g, '/').replace(/^\/+/, '');
  const byPath = wildcard.includes('/');
  const subject = byPath ? relativePath : relativePath.slice(relativePath.lastIndexOf('/') + 1);
  return patternRegex(wildcard.startsWith('.') ? `*${wildcard}` : wildcard, ignoreCase).test(subject);
}

/** Whether any of the patterns matches the file at `path`. */
export function matchesAnyFilePattern(patterns: readonly string[], path: string, ignoreCase: boolean): boolean {
  return patterns.some((pattern) => matchesFilePattern(pattern, path, ignoreCase));
}

function patternRegex(wildcard: string, ignoreCase: boolean): RegExp {
  let source = '';
  for (let index = 0; index < wildcard.length; index++) {
    const char = wildcard[index]!;
    if (char === '*' && wildcard[index + 1] === '*') {
      // `**/` is any number of folders, none included; `**` elsewhere anything at all.
      const folders = wildcard[index + 2] === '/';
      source += folders ? '(?:.*/)?' : '.*';
      index += folders ? 2 : 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`, ignoreCase ? 'i' : '');
}
