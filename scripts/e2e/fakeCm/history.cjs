// `cm history <file> --moveddeleted --xml` and the `cm find revision` that completes it: a workspace file's one
// revision, the one it loaded (revision 201 of item 301 at the loaded changeset, as `tree.cjs` lists every file).
const { FILES, OWNER, REPOSITORY, SERVER, WORKSPACE } = require('./repository.cjs');

const LOADED = { itemid: 301, id: 201, parent: -1, changeset: WORKSPACE.changeset };

/** The revisions `cm find revision` finds, their fields named as `--format` names them. */
const REVISIONS_FOUND = [LOADED];

/** The workspace-relative path of an absolute one, with forward slashes. */
function workspacePathOf(path) {
  return path.slice(WORKSPACE.path.length + 1).replaceAll('\\', '/');
}

/** `cm history <absolute path> --moveddeleted --xml`: its revisions, as `HISTORY_RECORD` elements. */
function historyOutput([path, ...options]) {
  if (!options.includes('--xml')) throw new Error('The fake cm prints a history only --xml');
  const relative = workspacePathOf(path);
  if (!path.startsWith(WORKSPACE.path) || FILES[relative]?.loaded === undefined) throw new Error(`The item ${path} has no history`);
  const revision = `<Revision><RevisionSpec>${path}#cs:${LOADED.changeset}</RevisionSpec><Branch>${WORKSPACE.branch}</Branch><CreationDate>2026-09-20T12:00:00+02:00</CreationDate><RevisionType>txt</RevisionType><ChangesetNumber>${LOADED.changeset}</ChangesetNumber><Owner>${OWNER}</Owner><Comment>Player jumps</Comment><Repository>${REPOSITORY}</Repository><Server>${SERVER}</Server><ItemId>${LOADED.itemid}</ItemId><Size>${Buffer.byteLength(FILES[relative].loaded)}</Size></Revision>`;
  return `<?xml version="1.0" encoding="utf-8"?><RevisionHistoriesResult><RevisionHistories><RevisionHistory><ItemName>${path}</ItemName><Revisions>${revision}</Revisions></RevisionHistory></RevisionHistories></RevisionHistoriesResult>\n`;
}

module.exports = { REVISIONS_FOUND, historyOutput };
