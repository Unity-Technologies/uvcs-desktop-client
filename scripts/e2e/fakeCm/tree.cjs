// `cm ls <directory> --xml`: the directory's items, from the workspace's files (a folder of the workspace, or
// `/folder` with `--tree=cs:N`). Loaded files are controlled at the loaded changeset, added in it (revision 201, no
// parent), with the loaded revision's size and hash; the others are private. `cm ls <path> --format=…` (the workspace's
// own listing, `workspaceListingArgs`, and a history's file, `workspaceItemArgs`) prints the same items as records.
const { createHash } = require('node:crypto');
const { escapeXml, formatRecords } = require('./format.cjs');
const { FILES, OWNER, REPOSITORY_SPEC, WORKSPACE } = require('./repository.cjs');

/** The listed folder relative to the workspace, with forward slashes: '' for its root. */
function folderOf(path) {
  const inWorkspace = path.startsWith(WORKSPACE.path) ? path.slice(WORKSPACE.path.length) : path;
  return inWorkspace.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
}

/** The loaded revision's MD5, base64, as `cm` keeps it, and its size. */
function hashAndSize(loaded) {
  const bytes = Buffer.from(loaded ?? '', 'utf8');
  return { hash: createHash('md5').update(bytes).digest('base64'), size: bytes.length };
}

/** The folders and files right under `folder`, each with its path relative to the workspace. */
function childrenOf(folder) {
  const prefix = folder ? `${folder}/` : '';
  const children = new Map();
  for (const [path, { loaded }] of Object.entries(FILES)) {
    if (!path.startsWith(prefix)) continue;
    const [name, ...below] = path.slice(prefix.length).split('/');
    const child = `${prefix}${name}`;
    children.set(child, below.length > 0 ? { type: 'dir', loaded: true, ...hashAndSize('') } : { type: 'txt', loaded: loaded !== undefined, ...hashAndSize(loaded) });
  }
  return [...children].map(([path, item]) => ({ path, ...item }));
}

function lsItem({ path, type, loaded, hash, size }) {
  const name = path.split('/').pop() || '.';
  const controlled = loaded
    ? `<Status>Controlled</Status><Changeset>${WORKSPACE.changeset}</Changeset><Branch>${WORKSPACE.branch}</Branch><Owner>${OWNER}</Owner><RevId>201</RevId><ParentRevId>-1</ParentRevId><ItemId>301</ItemId><Repository>rep:${REPOSITORY_SPEC}</Repository><Hash>${hash}</Hash>`
    : '<Status>Private</Status><Changeset>-1</Changeset><RevId>-1</RevId>';
  return `<LsItem>${controlled}<Name>${escapeXml(name)}</Name><WkPath>/${escapeXml(path)}</WkPath><Type>${type}</Type><Size>${loaded ? size : 42}</Size><Date>2026-09-20T12:00:00+02:00</Date><Checkout></Checkout></LsItem>`;
}

/** An item as `--format` prints it: its fields named as `cm` names them. */
function lsRecord({ path, type, loaded, hash, size }) {
  return { wkpath: path, type, revid: loaded ? 201 : -1, hash: loaded ? hash : '', size, repspec: loaded ? `rep:${REPOSITORY_SPEC}` : '' };
}

/** The answer to `cm ls <path> …`: the path itself (`.` in `--xml`), then what a folder holds. */
function lsOutput(args) {
  const path = folderOf(args[0]);
  const file = FILES[path];
  const self = file ? { path, type: 'txt', loaded: file.loaded !== undefined, ...hashAndSize(file.loaded) } : { path, type: 'dir', loaded: true, ...hashAndSize('') };
  const items = file ? [self] : [self, ...childrenOf(path)];
  const format = args.find((arg) => arg.startsWith('--format='));
  if (format) return formatRecords(format.slice('--format='.length), items.map(lsRecord));
  return `<?xml version="1.0" encoding="utf-8"?><LsResults><LsItems>${items.map((item, i) => lsItem(i === 0 && !file ? { ...item, path: '' } : item)).join('')}</LsItems></LsResults>\n`;
}

module.exports = { lsOutput };
