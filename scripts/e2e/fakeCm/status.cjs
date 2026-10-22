// `cm status`: what the workspace is loaded from (`--header --xml`) and its pending changes as records
// (`--machinereadable`), the files the user edited (`onDisk` and `loaded`, CH) and the private ones (`onDisk` only, PR).
const { join } = require('node:path');
const { FILES, REPOSITORY, SERVER, WORKSPACE } = require('./repository.cjs');

function header() {
  const status = `<Status><RepSpec><Server>${SERVER}</Server><Name>${REPOSITORY}</Name></RepSpec><Changeset>${WORKSPACE.changeset}</Changeset></Status>`;
  return `<WorkspaceStatus>${status}</WorkspaceStatus><WkConfigType>Branch</WkConfigType><WkConfigName>${WORKSPACE.branch}@${REPOSITORY}@${SERVER}</WkConfigName>`;
}

/** The pending changes as `cm` prints them: `<codes> <absolute path> <is folder> <merges>`, with the OS's separator. */
function changes(withPrivate) {
  return Object.entries(FILES)
    .filter(([, { loaded, onDisk }]) => onDisk !== undefined && (loaded !== undefined || withPrivate))
    .map(([path, { loaded }]) => [loaded === undefined ? 'PR' : 'CH', join(WORKSPACE.path, path), 'False', 'NO_MERGES']);
}

/** The options that ask for some kinds of change; asked for none, `cm status` lists every kind, private files too. */
const KIND_OPTIONS = new Set(['--controlledchanged', '--changed', '--checkout', '--localdeleted', '--localmoved', '--private', '--added', '--deleted', '--moved']);

/** The value of `--<name>=<value>`, as `cm` takes the machine-readable separators. */
function option(args, name) {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? '';
}

/** `cm status --machinereadable`: a `STATUS` record, then, with `--changelists`, the Default changelist and its changes. */
function statusRecords(args) {
  const [field, end] = [option(args, 'fieldseparator') || ' ', option(args, 'endlineseparator')];
  const records = [
    ['STATUS', WORKSPACE.changeset, REPOSITORY, SERVER],
    ...(args.includes('--changelists') ? [['CHLIST', 'Default', 'Default Unity VCS changelist']] : []),
    ...changes(args.includes('--private') || !args.some((arg) => KIND_OPTIONS.has(arg))),
  ];
  return records.map((fields) => `${fields.join(field)}${end}\n`).join('');
}

/** The answer to `cm status <args>`: the header alone with `--header --xml`, the changes as records with `--machinereadable`. */
function statusOutput(args) {
  if (args.includes('--machinereadable') && !args.includes('--header')) return statusRecords(args);
  if (!args.includes('--xml') || !args.includes('--header')) throw new Error('The fake cm answers cm status only with --header --xml or --machinereadable');
  return `<?xml version="1.0" encoding="utf-8"?><StatusOutput>${header()}</StatusOutput>\n`;
}

module.exports = { statusOutput };
