/**
 * The official Desktop client keeps each workspace's recent branches in `plasticgui.conf`, under a section named after
 * the workspace GUID: `recentbranches=<guid>;<guid>;` (newest first, at most five, never /main). These read and edit
 * that entry the way its `ConfigurationFile` parses it: `[section]` lines, `key=value` entries with case-insensitive
 * keys (the last one wins), `;` and `#` comments. Everything else in the file is left as it is.
 */

const KEY = 'recentbranches';
const SEPARATOR = ';';
export const MAX_RECENT_BRANCHES = 5;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Line = { kind: 'section'; name: string } | { kind: 'entry'; key: string; value: string } | { kind: 'other' };

export function readRecentBranches(conf: string, workspaceGuid: string): string[] {
  let value = '';
  forEachEntryOf(conf.split(/\r\n|\r|\n/), workspaceGuid, (entry) => (value = entry.value));
  return parseGuids(value);
}

/** The conf with `branchGuid` first among the workspace's recent branches. */
export function withRecentBranch(conf: string, workspaceGuid: string, branchGuid: string): string {
  const guid = branchGuid.toLowerCase();
  const recent = [guid, ...readRecentBranches(conf, workspaceGuid).filter((other) => other !== guid)].slice(0, MAX_RECENT_BRANCHES);
  const value = recent.map((other) => other + SEPARATOR).join('');

  const eol = conf.includes('\r\n') ? '\r\n' : '\n';
  const lines = conf === '' ? [] : conf.split(/\r\n|\r|\n/);
  let replaced = false;
  forEachEntryOf(lines, workspaceGuid, (entry, index) => {
    lines[index] = `${entry.key}=${value}`;
    replaced = true;
  });
  if (replaced) return lines.join(eol);

  const header = lines.findLastIndex((line) => isSection(parseLine(line), workspaceGuid));
  if (header !== -1) {
    lines.splice(header + 1, 0, `${KEY}=${value}`);
    return lines.join(eol);
  }
  // A new section at the end, followed by a blank line like the official client writes it.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return [...lines, ...(lines.length > 0 ? [''] : []), `[${workspaceGuid}]`, `${KEY}=${value}`, '', ''].join(eol);
}

function forEachEntryOf(lines: string[], section: string, visit: (entry: { key: string; value: string }, index: number) => void): void {
  let inSection = false;
  lines.forEach((text, index) => {
    const line = parseLine(text);
    if (line.kind === 'section') inSection = line.name === section;
    else if (inSection && line.kind === 'entry' && line.key.toLowerCase() === KEY) visit(line, index);
  });
}

function parseLine(line: string): Line {
  if (line === '' || line.startsWith(';') || line.startsWith('#')) return { kind: 'other' };
  if (line.startsWith('[')) return { kind: 'section', name: line.replace(/^[[ ]+/, '').replace(/[\] ]+$/, '') };
  const split = line.indexOf('=');
  return split < 0 ? { kind: 'entry', key: line, value: '' } : { kind: 'entry', key: line.slice(0, split), value: line.slice(split + 1) };
}

function isSection(line: Line, name: string): boolean {
  return line.kind === 'section' && line.name === name;
}

function parseGuids(value: string): string[] {
  return value
    .split(SEPARATOR)
    .map((guid) => guid.trim().replace(/^\{(.*)\}$/, '$1').toLowerCase())
    .filter((guid) => GUID.test(guid));
}
