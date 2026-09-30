// What the fake `cm` answers to each command, from the synthetic repository. A command, subcommand or `--format`
// field it doesn't know fails, naming it: the smoke test then fails and says what to teach it.
const { writeFileSync } = require('node:fs');
const { findXml, formatRecords } = require('./format.cjs');
const repository = require('./repository.cjs');
const { statusOutput } = require('./status.cjs');
const { lsOutput } = require('./tree.cjs');
const { matching } = require('./where.cjs');

/** What `cm find <object>` searches, and the element `--xml` prints each object as (`cm` prints labels as MARKER). */
const FINDABLE = {
  attribute: { element: 'ATTRIBUTE', records: repository.ATTRIBUTES },
  attributetype: { element: 'ATTRIBUTEENTITY', records: repository.ATTRIBUTE_TYPES },
  branch: { element: 'BRANCH', records: repository.BRANCHES },
  changeset: { element: 'CHANGESET', records: repository.CHANGESETS },
  label: { element: 'MARKER', records: repository.LABELS },
  merge: { element: 'MERGE', records: repository.MERGES },
  review: { element: 'REVIEW', records: repository.REVIEWS },
  shelve: { element: 'SHELVE', records: repository.SHELVES },
};

const { DIFFERENCES, FILES, LOCKS, OWNER, REPOSITORIES, REVISIONS, SERVER, WORKSPACE } = repository;

const ACCOUNTS = [{ name: SERVER, server: SERVER, user: OWNER, workingmode: 'UPWorkingMode' }];
const WORKSPACES = [{ wkname: WORKSPACE.name, wkpath: WORKSPACE.path, path: WORKSPACE.path, wkid: WORKSPACE.guid, guid: WORKSPACE.guid }];

const COMMANDS = {
  version: () => '11.0.16.9000\n',
  checkconnection: () => 'Test connection executed successfully\n',
  whoami: () => `${OWNER}\n`,
  'profile list': (args) => formatted(args, ACCOUNTS),
  'workspace list': (args) => formatted(args, WORKSPACES),
  getworkspacefrompath: (args) => formatted(args, WORKSPACES),
  status: statusOutput,
  find: find,
  diff: (args) => formatted(args, DIFFERENCES),
  cat: cat,
  ls: lsOutput,
  'lock list': lockList,
  'repository list': (args) => formatted(args, REPOSITORIES),
};

/** `cm find <object> <query> --xml|--format=…`: the objects the query's comparisons keep (`where.cjs`). */
function find([object, ...args]) {
  const findable = FINDABLE[object.toLowerCase()];
  if (!findable) throw new Error(`The fake cm can't find ${object} objects`);
  const found = matching(findable.records, args.filter((arg) => !arg.startsWith('--')).join(' '));
  return args.includes('--xml') ? findXml(findable.element, found) : formatted(args, found);
}

/** `cm cat <spec> --file=<target>`: a revision by id (`revid:201@…`), else the loaded revision of a workspace path. */
function cat([spec, target]) {
  const revision = /^revid:(\d+)/.exec(spec)?.[1];
  const content = revision ? REVISIONS[revision] : loadedContent(spec);
  if (content === undefined) throw new Error(`The fake cm has no revision ${spec}`);
  if (!target?.startsWith('--file=')) throw new Error('The fake cm writes revisions only to a --file');
  writeFileSync(target.slice('--file='.length), content);
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

/** `records` printed through the command's `--format`. */
function formatted(args, records) {
  const format = args.find((arg) => arg.startsWith('--format='));
  if (!format) throw new Error('The fake cm lists objects only with --format');
  return formatRecords(format.slice('--format='.length), records);
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
