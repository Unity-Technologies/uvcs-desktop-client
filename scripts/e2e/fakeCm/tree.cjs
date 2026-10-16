// `cm ls <path> --format=…`: the path itself, then a directory's items, from the workspace's files (a folder of the
// workspace, or `/folder` with `--tree=cs:N`). Loaded files are controlled at the loaded changeset (revision 201), added
// in it or, with a `parent`, changed from revision 200, with the loaded revision's size and hash; the others are
// private: no revision, nor anything but their name, path, type, size and date.
const { createHash } = require('node:crypto');
const { formatRecords } = require('./format.cjs');
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
  for (const [path, { loaded, parent }] of Object.entries(FILES)) {
    if (!path.startsWith(prefix)) continue;
    const [name, ...below] = path.slice(prefix.length).split('/');
    const child = `${prefix}${name}`;
    children.set(child, below.length > 0 ? { type: 'dir', loaded: true, ...hashAndSize('') } : { type: 'txt', loaded: loaded !== undefined, changed: parent !== undefined, ...hashAndSize(loaded) });
  }
  return [...children].map(([path, item]) => ({ path, ...item }));
}

/** An item as `--format` prints it: its fields named as `cm` names them; the listed folder itself is `.`. */
function lsRecord({ path, type, loaded, changed, hash, size }, isListedFolder) {
  const name = isListedFolder ? '.' : path.split('/').pop();
  const common = { name, wkpath: path, type, size, date: '2026-09-20T12:00:00.0000000+02:00', symlinktarget: '' };
  const none = { checkout: '', changeset: '', branch: '', owner: '', revid: '', parentrevid: '', repspec: '', itemid: '', hash: '' };
  if (!loaded) return { ...common, ...none };
  const controlled = { checkout: '', changeset: WORKSPACE.changeset, branch: WORKSPACE.branch, owner: OWNER, revid: 201, parentrevid: changed ? 200 : -1, itemid: 301 };
  return { ...common, ...controlled, repspec: `rep:${REPOSITORY_SPEC}`, hash };
}

/** The answer to `cm ls <path> --format=…`: the path itself, then what a folder holds. */
function lsOutput(args) {
  const path = folderOf(args[0]);
  const file = FILES[path];
  const self = file ? { path, type: 'txt', loaded: file.loaded !== undefined, ...hashAndSize(file.loaded) } : { path, type: 'dir', loaded: true, ...hashAndSize('') };
  const items = file ? [self] : [self, ...childrenOf(path)];
  const format = args.find((arg) => arg.startsWith('--format='));
  if (!format) throw new Error('The fake cm lists items only with --format');
  return formatRecords(format.slice('--format='.length), items.map((item, index) => lsRecord(item, index === 0 && !file)));
}

module.exports = { lsOutput };
