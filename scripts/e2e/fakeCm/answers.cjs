// What the fake `cm` answers to each command, from the synthetic repository. A command, subcommand or `--format`
// field it doesn't know fails, naming it: the smoke test then fails and says what to teach it.
const { writeFileSync } = require('node:fs');
const { formatRecords } = require('./format.cjs');
const repository = require('./repository.cjs');
const { statusOutput } = require('./status.cjs');
const { lsOutput } = require('./tree.cjs');
const { matching } = require('./where.cjs');

/** What `cm find <object>` searches. */
const FINDABLE = {
  attribute: repository.ATTRIBUTES,
  attributetype: repository.ATTRIBUTE_TYPES,
  branch: repository.BRANCHES,
  changeset: repository.CHANGESETS,
  label: repository.LABELS,
  merge: repository.MERGES,
  review: repository.REVIEWS,
  shelve: repository.SHELVES,
};

const { DIFFERENCES, FILES, LOCKS, OWNER, REPOSITORIES, REPOSITORY_SPEC, REVISIONS, SERVER, WORKSPACE } = repository;

/** A Unity organization the user signed in to, besides the workspace's server: the home screen lists its projects. */
const ORGANIZATION = 'studio@unity';
const ACCOUNTS = [
  { name: SERVER, server: SERVER, user: OWNER, workingmode: 'UPWorkingMode' },
  { name: ORGANIZATION, server: ORGANIZATION, user: OWNER, workingmode: 'SSOWorkingMode' },
];
/** As `cm repository list --type=all` prints a Unity organization: its projects, their repositories, and storage. */
const ORGANIZATION_REPOSITORIES = [
  { repid: 2, repname: 'Racing', repserver: ORGANIZATION, repowner: OWNER, reptype: 'Project' },
  { repid: 3, repname: 'Racing/Game', repserver: ORGANIZATION, repowner: OWNER, reptype: 'VCS' },
  { repid: 4, repname: 'Puzzle', repserver: ORGANIZATION, repowner: OWNER, reptype: 'Project' },
  { repid: 5, repname: 'Puzzle/Levels', repserver: ORGANIZATION, repowner: OWNER, reptype: 'VCS' },
  { repid: 6, repname: 'storage', repserver: ORGANIZATION, repowner: OWNER, reptype: 'WorkspaceStorage' },
];
const WORKSPACES = [{ wkname: WORKSPACE.name, wkpath: WORKSPACE.path, path: WORKSPACE.path, wkid: WORKSPACE.guid, guid: WORKSPACE.guid }];

const COMMANDS = {
  version: () => '11.0.16.9000\n',
  checkconnection: () => 'Test connection executed successfully\n',
  whoami: () => `${OWNER}\n`,
  // Without --format: the local setup check (`checkSetup`), which reads only whether it succeeds.
  'profile list': (args) => (args.some((arg) => arg.startsWith('--format=')) ? formatted(args, ACCOUNTS) : `${SERVER}\n`),
  'workspace list': (args) => formatted(args, WORKSPACES),
  getworkspacefrompath: (args) => formatted(args, WORKSPACES),
  status: statusOutput,
  wi: workspaceInfo,
  find: find,
  diff: (args) => formatted(args, DIFFERENCES),
  cat: cat,
  ls: lsOutput,
  'lock list': lockList,
  'repository list': repositoryList,
  showacl: showAcl,
  showowner: ([spec]) => `${spec} ${OWNER} User\n`,
  listusers: ([, kind]) => (kind === '--onlygroups' ? 'Developers\nArtists\n' : `${OWNER}\nana@example.com\n`),
  acl: () => 'Command finished successfully\n',
  setowner: () => '',
};

/**
 * `cm showacl <spec> --extended`, indented as cm 11 prints it: every object shares the repository's list, which
 * inherits the server's (`extendedAclOutput` in main/cm/testing/cmOutput.ts builds the same in the unit tests).
 */
function showAcl([spec, option]) {
  if (option !== '--extended') throw new Error('The fake cm shows access control lists only --extended');
  if (spec.startsWith('path:')) throw new Error(`Incorrect object specification ${spec}`);
  return [
    '  ACL: 1',
    `    Creator rep:${repository.REPOSITORY}@repserver:${SERVER}`,
    '    Entries',
    '     Developers:',
    '       Allowed:',
    '        view read ci add change move rm mkchildbranch mergefrom',
    '     Artists:',
    '       Denied:',
    '        rm',
    '    Inherited',
    '      ACL: 0',
    `        Creator repserver:${SERVER}`,
    '        Entries',
    '         ALL USERS:',
    '           Allowed:',
    '            all',
    '',
  ].join('\n');
}

/** `cm find <object> <query> --format=…`: the objects the query's comparisons keep (`where.cjs`). */
function find([object, ...args]) {
  const records = FINDABLE[object.toLowerCase()];
  if (!records) throw new Error(`The fake cm can't find ${object} objects`);
  return formatted(args, matching(records, args.filter((arg) => !arg.startsWith('--')).join(' ')));
}

/**
 * `cm cat <spec> --file=<target>`, or `cm cat <spec>;<target> …` for revisions asked together: a revision by id
 * (`revid:201@…`), else the loaded revision of a workspace path.
 */
function cat(args) {
  const [spec, target] = args;
  if (args.length === 2 && target?.startsWith('--file=')) return writeRevision(spec, target.slice('--file='.length));
  for (const arg of args) {
    const separator = arg.indexOf(';');
    if (separator < 0) throw new Error('The fake cm writes revisions only to a --file, or each to its <spec>;<file>');
    writeRevision(arg.slice(0, separator), arg.slice(separator + 1));
  }
  return '';
}

function writeRevision(spec, target) {
  const revision = /^revid:(\d+)/.exec(spec)?.[1];
  const content = revision ? REVISIONS[revision] : loadedContent(spec);
  if (content === undefined) throw new Error(`The fake cm has no revision ${spec}`);
  writeFileSync(target, content);
  return '';
}

function loadedContent(path) {
  const relative = path.slice(WORKSPACE.path.length + 1).replaceAll('\\', '/');
  return path.startsWith(WORKSPACE.path) ? FILES[relative]?.loaded : undefined;
}

/** `cm lock list --machinereadable --fieldseparator=… --endlineseparator=…`: its fields in `cm`'s order. */
function lockList(args) {
  const separator = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? ' ';
  return LOCKS.map((lock) => Object.values(lock).join(separator('fieldseparator')) + separator('endlineseparator')).join('');
}

/** `cm wi <path> --machinereadable --fieldseparator=…`: the workspace's branch and repository, on one line. */
function workspaceInfo([path, ...options]) {
  if (path !== WORKSPACE.path) throw new Error(`${path} is not in a workspace.`);
  const separator = options.find((option) => option.startsWith('--fieldseparator='))?.slice('--fieldseparator='.length);
  if (!options.includes('--machinereadable') || !separator) throw new Error('The fake cm tells a workspace only --machinereadable, with a --fieldseparator');
  return ['BR', WORKSPACE.branch, REPOSITORY_SPEC].join(separator) + '\n';
}

/** `records` printed through the command's `--format`. */
function formatted(args, records) {
  const format = args.find((arg) => arg.startsWith('--format='));
  if (!format) throw new Error('The fake cm lists objects only with --format');
  return formatRecords(format.slice('--format='.length), records);
}

/** `cm repository list <server>`: a Unity organization's projects come only with `--type=all`, as `cm` lists them. */
function repositoryList(args) {
  if (args[0] !== ORGANIZATION) return formatted(args, REPOSITORIES);
  return formatted(args, args.includes('--type=all') ? ORGANIZATION_REPOSITORIES : ORGANIZATION_REPOSITORIES.filter((record) => record.reptype === 'VCS'));
}

/** The command, as the longest name `COMMANDS` knows (`lock list` before `lock`), and its arguments. */
function commandOf(args) {
  const twoWords = args.slice(0, 2).join(' ');
  if (COMMANDS[twoWords]) return { reply: COMMANDS[twoWords], rest: args.slice(2) };
  return { reply: COMMANDS[args[0]], rest: args.slice(1) };
}

/** The answer to `cm <args>`: its output and exit code. */
function answer(args) {
  const { reply, rest } = commandOf(args);
  try {
    if (!reply) throw new Error("The fake cm doesn't know this command");
    return { output: reply(rest), exitCode: 0 };
  } catch (error) {
    return { output: `${error.message}: cm ${args.join(' ')}\n`, exitCode: 1 };
  }
}

module.exports = { answer };
