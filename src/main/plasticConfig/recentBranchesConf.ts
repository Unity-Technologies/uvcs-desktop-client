/**
 * The official Desktop client keeps each workspace's recent branches in `plasticgui.conf`, under a section named after
 * the workspace GUID: `recentbranches=<guid>;<guid>;` (newest first, at most five, never /main). This reads them the
 * way its `ConfigurationFile` parses the file: `[section]` lines, `key=value` entries with case-insensitive keys (the
 * last one wins), `;` and `#` comments. Read once, by `importLegacySettings`; the app never writes the file.
 */

const KEY = 'recentbranches';
const SEPARATOR = ';';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Line = { kind: 'section'; name: string } | { kind: 'entry'; key: string; value: string } | { kind: 'other' };

/** Each workspace's recent branch GUIDs, by workspace GUID (lowercase); workspaces without any are left out. */
export function readRecentBranchesByWorkspace(conf: string): Record<string, string[]> {
  const valueBySection = new Map<string, string>();
  let section = '';
  for (const text of conf.split(/\r\n|\r|\n/)) {
    const line = parseLine(text);
    if (line.kind === 'section') section = line.name.toLowerCase();
    else if (line.kind === 'entry' && line.key.toLowerCase() === KEY) valueBySection.set(section, line.value);
  }
  const recentByWorkspace = [...valueBySection].map(([workspaceGuid, value]) => [workspaceGuid, parseGuids(value)] as const);
  return Object.fromEntries(recentByWorkspace.filter(([workspaceGuid, guids]) => GUID.test(workspaceGuid) && guids.length > 0));
}

function parseLine(line: string): Line {
  if (line === '' || line.startsWith(';') || line.startsWith('#')) return { kind: 'other' };
  if (line.startsWith('[')) return { kind: 'section', name: line.replace(/^[[ ]+/, '').replace(/[\] ]+$/, '') };
  const split = line.indexOf('=');
  return split < 0 ? { kind: 'entry', key: line, value: '' } : { kind: 'entry', key: line.slice(0, split), value: line.slice(split + 1) };
}

function parseGuids(value: string): string[] {
  return value
    .split(SEPARATOR)
    .map((guid) => guid.trim().replace(/^\{(.*)\}$/, '$1').toLowerCase())
    .filter((guid) => GUID.test(guid));
}
