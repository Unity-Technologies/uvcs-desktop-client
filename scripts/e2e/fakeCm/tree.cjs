// `cm ls <directory> --xml`: the directory's items, from the workspace's files (a folder of the workspace, or
// `/folder` with `--tree=cs:N`). Loaded files are controlled at the loaded changeset; the others are private.
const { escapeXml } = require('./format.cjs');
const { FILES, OWNER, REPOSITORY_SPEC, WORKSPACE } = require('./repository.cjs');

/** The listed folder relative to the workspace, with forward slashes: '' for its root. */
function folderOf(path) {
  const inWorkspace = path.startsWith(WORKSPACE.path) ? path.slice(WORKSPACE.path.length) : path;
  return inWorkspace.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
}

/** The folders and files right under `folder`, each with its path relative to the workspace. */
function childrenOf(folder) {
  const prefix = folder ? `${folder}/` : '';
  const children = new Map();
  for (const [path, { loaded }] of Object.entries(FILES)) {
    if (!path.startsWith(prefix)) continue;
    const [name, ...below] = path.slice(prefix.length).split('/');
    const child = `${prefix}${name}`;
    children.set(child, below.length > 0 ? { type: 'dir', loaded: true } : { type: 'txt', loaded: loaded !== undefined });
  }
  return [...children].map(([path, item]) => ({ path, ...item }));
}

function lsItem({ path, type, loaded }) {
  const name = path.split('/').pop() || '.';
  const controlled = loaded
    ? `<Status>Controlled</Status><Changeset>${WORKSPACE.changeset}</Changeset><Branch>${WORKSPACE.branch}</Branch><Owner>${OWNER}</Owner><RevId>201</RevId><ParentRevId>200</ParentRevId><ItemId>301</ItemId><Repository>rep:${REPOSITORY_SPEC}</Repository>`
    : '<Status>Private</Status><Changeset>-1</Changeset><RevId>-1</RevId>';
  return `<LsItem>${controlled}<Name>${escapeXml(name)}</Name><WkPath>/${escapeXml(path)}</WkPath><Type>${type}</Type><Size>42</Size><Date>2026-09-20T12:00:00+02:00</Date><Checkout></Checkout></LsItem>`;
}

/** The answer to `cm ls <directory> … --xml`: the directory itself as `.`, then what it holds. */
function lsOutput([directory]) {
  const items = [lsItem({ path: '', type: 'dir', loaded: true }), ...childrenOf(folderOf(directory)).map(lsItem)];
  return `<?xml version="1.0" encoding="utf-8"?><LsResults><LsItems>${items.join('')}</LsItems></LsResults>\n`;
}

module.exports = { lsOutput };
