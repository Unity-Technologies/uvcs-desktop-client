// `cm status --xml`: what the workspace is loaded from and its pending changes, the files the user edited
// (`onDisk` and `loaded`, CH) and the private ones (`onDisk` only, PR).
const { join } = require('node:path');
const { escapeXml } = require('./format.cjs');
const { FILES, REPOSITORY, SERVER, WORKSPACE } = require('./repository.cjs');

function header() {
  const status = `<Status><RepSpec><Server>${SERVER}</Server><Name>${REPOSITORY}</Name></RepSpec><Changeset>${WORKSPACE.changeset}</Changeset></Status>`;
  return `<WorkspaceStatus>${status}</WorkspaceStatus><WkConfigType>Branch</WkConfigType><WkConfigName>${WORKSPACE.branch}@${REPOSITORY}@${SERVER}</WkConfigName>`;
}

/** The pending changes as `cm` lists them: paths relative to the workspace, with the OS's separator. */
function changes(withPrivate) {
  return Object.entries(FILES)
    .filter(([, { loaded, onDisk }]) => onDisk !== undefined && (loaded !== undefined || withPrivate))
    .map(([path, { loaded, onDisk }]) => {
      const type = loaded === undefined ? 'PR' : 'CH';
      const size = Buffer.byteLength(onDisk);
      return `<Change><Type>${type}</Type><Path>${escapeXml(join(path))}</Path><OldPath></OldPath><MergesInfo></MergesInfo><SimilarityPerUnit>0</SimilarityPerUnit><Size>${size}</Size><RevisionType>enTextFile</RevisionType><LastModified>2026-09-25T08:26:09+02:00</LastModified></Change>`;
    })
    .join('');
}

/** The answer to `cm status <args>`: the header alone with `--header`, the changes in the Default changelist with `--changelists`. */
function statusOutput(args) {
  if (!args.includes('--xml')) throw new Error('The fake cm answers cm status only with --xml');
  const listed = args.includes('--header') ? '' : changes(args.includes('--private'));
  const body = args.includes('--changelists')
    ? `<Changelists><Changelist><Name>Default</Name><Description></Description><Changes>${listed}</Changes></Changelist></Changelists>`
    : `<Changes>${listed}</Changes>`;
  return `<?xml version="1.0" encoding="utf-8"?><StatusOutput>${header()}${body}</StatusOutput>\n`;
}

module.exports = { statusOutput };
