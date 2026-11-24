// What the fake `cm` answers to each command, from the synthetic repository. A command, subcommand or `--format`
// field it doesn't know fails, naming it: the smoke test then fails and says what to teach it.
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { formatRecords } = require('./format.cjs');
const repository = require('./repository.cjs');
const { statusOutput } = require('./status.cjs');
const { lsOutput } = require('./tree.cjs');
const { signInFailure } = require('./signIn.cjs');
const { matching } = require('./where.cjs');
const { version: PINNED_CM_VERSION } = require('../../../cm-version.json');

/** A command `cm` itself refuses, as it would the real one: it fails, but the fake knew what to answer. */
class CmRefusal extends Error {}

/** What `cm find <object>` searches. */
const FINDABLE = {
  attribute: repository.ATTRIBUTES,
  attributetype: repository.ATTRIBUTE_TYPES,
  branch: repository.BRANCHES,
  changereviewcomment: repository.REVIEW_COMMENTS,
  changeset: repository.CHANGESETS,
  label: repository.LABELS,
  merge: repository.MERGES,
  review: repository.REVIEWS,
  shelve: repository.SHELVES,
};

const { DIFFERENCES, FILES, LOCKS, OWNER, REPOSITORIES, REPOSITORY_SPEC, REVISIONS, SERVER, WORKSPACE } = repository;

/** A Unity organization the user signed in to, besides the workspace's server: the home screen lists its projects. */
const ORGANIZATION = 'studio@unity';
/** A cloud organization of the owner's too: with two, the owner's account is the one Home shows first (`mainAccountOf`). */
const OWNER_CLOUD_ORGANIZATION = 'workshop@cloud';
/** A second Unity account, with one organization of its own: Home's account switcher, tried by hand, lists both. */
const OTHER_USER = 'zoe@example.com';
const OTHER_ORGANIZATION = 'arcade@unity';
const ACCOUNTS = [
  { name: SERVER, server: SERVER, user: OWNER, workingmode: 'UPWorkingMode' },
  { name: ORGANIZATION, server: ORGANIZATION, user: OWNER, workingmode: 'SSOWorkingMode' },
  { name: OWNER_CLOUD_ORGANIZATION, server: OWNER_CLOUD_ORGANIZATION, user: OWNER, workingmode: 'SSOWorkingMode' },
  { name: OTHER_ORGANIZATION, server: OTHER_ORGANIZATION, user: OTHER_USER, workingmode: 'SSOWorkingMode' },
];
/** As `cm repository list --type=all` prints a Unity organization: its projects, their repositories, a deleted one, and storage. */
const ORGANIZATION_REPOSITORIES = [
  { repid: 2, repname: 'Racing', repserver: ORGANIZATION, repowner: OWNER, reptype: 'Project', repguid: '00000000-0000-4000-8000-000000000002' },
  { repid: 3, repname: 'Racing/Game', repserver: ORGANIZATION, repowner: OWNER, reptype: 'VCS', repguid: '00000000-0000-4000-8000-000000000003' },
  { repid: 4, repname: 'Puzzle', repserver: ORGANIZATION, repowner: OWNER, reptype: 'Project', repguid: '00000000-0000-4000-8000-000000000004' },
  { repid: 5, repname: 'Puzzle/Levels', repserver: ORGANIZATION, repowner: OWNER, reptype: 'VCS', repguid: '00000000-0000-4000-8000-000000000005' },
  { repid: 6, repname: 'storage', repserver: ORGANIZATION, repowner: OWNER, reptype: 'WorkspaceStorage', repguid: '00000000-0000-4000-8000-000000000006' },
  // Deleted, and still kept: listed to the organization's administrators under its name after `__DELETED__`.
  { repid: 7, repname: '__DELETED__Racing/Old', repserver: ORGANIZATION, repowner: OWNER, reptype: 'VCS', repguid: '00000000-0000-4000-8000-000000000007' },
];
/** The workspace as `cm workspace list` and `cm getworkspacefrompath` print it: a standard one (`type`, `dynamic`). */
const WORKSPACES = [{ wkname: WORKSPACE.name, wkpath: WORKSPACE.path, path: WORKSPACE.path, wkid: WORKSPACE.guid, guid: WORKSPACE.guid, type: 'regular', dynamic: 'static' }];

/**
 * The version it prints: the one the app pins, or what `UVCS_FAKE_CM_VERSION_FILE` names (read on every command), to be
 * an installed `cm` older than the app needs: the update screen (docs/features/cm-runtime.md "The update screen").
 */
function version() {
  const file = process.env.UVCS_FAKE_CM_VERSION_FILE;
  const named = file && existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
  return `${named || PINNED_CM_VERSION}\n`;
}

const COMMANDS = {
  version,
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
  listusers: ([, kind]) => (kind === '--onlygroups' ? `${GROUPS.join('\n')}\n` : `${OWNER}\nana@example.com\n`),
  acl: () => 'Command finished successfully\n',
  setowner: () => '',
  'codereview reviewer': reviewerList,
  'codereview subscription': reviewSubscription,
  // A merge request's state or destination: `cm` prints nothing. No smoke step moves one; it stays for trying it by hand.
  'mergerequest edit': () => '',
  // A new merge request: `cm` prints its id alone. The fake keeps no new review: the lists read stay as they are.
  'mergerequest create': () => `${NEW_MERGE_REQUEST_ID}\n`,
  merge: mergeRefusedByRules,
};

/** The id the fake gives a merge request it is asked to create: after every review `repository.REVIEWS` holds. */
const NEW_MERGE_REQUEST_ID = 90;

/**
 * `cm merge <branch> --to=<branch>`, previewed: refused by the server's merge rules, as `cm` words them in English
 * (docs/features/merge-requests.md "Merging"). task-001, with an open merge request, isn't reviewed yet; task-002 has
 * none. The fake merges nothing else.
 */
function mergeRefusedByRules([source, ...options]) {
  const to = options.find((option) => option.startsWith('--to='));
  if (options.includes('--merge') || !to) throw new Error('The fake cm only previews merges to a branch');
  const [branch, destination] = [source.replace(/^br:/, ''), to.slice('--to=br:'.length)];
  const rules = 'Cannot perform the merge because of the Merge Rules.';
  if (branch === '/main/task-001') throw new CmRefusal(`${rules} Review the branch '${branch}' to merge it to '${destination}'.`);
  if (branch === '/main/task-002') throw new CmRefusal(`${rules} Branch '${branch}' needs an open merge request to '${destination}'.`);
  throw new Error(`The fake cm doesn't merge ${source}`);
}

/** The server's groups, as `cm listusers --onlygroups` lists them. */
const GROUPS = ['Developers', 'Artists'];

/** `cm codereview reviewer list <id> --format=…`: the review's reviewers, each typed `user` or `group`. */
function reviewerList(args) {
  const [action, id] = args;
  if (action !== 'list') throw new Error(`The fake cm doesn't change reviewers (${action})`);
  const review = repository.REVIEWS.find((each) => String(each.id) === id);
  if (!review) throw new Error(`The code review ${id} does not exist`);
  const reviewers = review.reviewers.split(',').filter(Boolean).map((pair) => {
    const colon = pair.lastIndexOf(':');
    const user = pair.slice(0, colon);
    return { user, status: pair.slice(colon + 1), type: GROUPS.includes(user) ? 'group' : 'user' };
  });
  return formatted(args, reviewers);
}

/**
 * `cm codereview subscription <id> --format=…`: the user gets a review's emails as one of its reviewers, and the
 * repository sends them, so the review's page shows Notifications.
 */
function reviewSubscription(args) {
  const [id] = args;
  const review = repository.REVIEWS.find((each) => String(each.id) === id);
  if (!review) throw new Error(`The specified code review '${id}' could not be found`);
  const reviewer = review.reviewers.split(',').some((pair) => pair.startsWith(`${OWNER}:`));
  return formatted(args, [{ subscribed: reviewer ? 'yes' : 'no', reason: reviewer ? 'reviewer' : 'none', emails: 'enabled' }]);
}

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

/**
 * The answer to `cm <args>`: its output and exit code, or the prompt it waits at. A server whose session ended
 * (`signIn.cjs`) is answered as `cm` would, which is no command the fake doesn't know.
 */
function answer(args) {
  const signIn = signInFailure(args, { workspaceServer: SERVER, otherServers: [ORGANIZATION] });
  if (signIn) return { ...signIn, refused: true };
  const { reply, rest } = commandOf(args);
  try {
    if (!reply) throw new Error("The fake cm doesn't know this command");
    return { output: reply(rest), exitCode: 0 };
  } catch (error) {
    if (error instanceof CmRefusal) return { output: `${error.message}\n`, exitCode: 1, refused: true };
    return { output: `${error.message}: cm ${args.join(' ')}\n`, exitCode: 1 };
  }
}

module.exports = { answer };
