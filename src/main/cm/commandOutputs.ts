/**
 * What a `cm` command prints, which decides how `CmClient` may read it (ARCHITECTURE.md "Reading `cm` output"). No
 * output that grows with the repository or the workspace is ever held as one string: V8 refuses strings past about
 * 512 MB, and long before that one string costs the main process what the whole output weighs, twice.
 *
 * - `list`: rows that grow with the repository or the workspace (branches, a tree, a diff, pending changes, an item's
 *   history). Read as they arrive (`queryRecords`, `executeRecords`, `queryXmlElements`); `query` and `execute` refuse it.
 * - `answer`: one small object (the user, a workspace's header, an item's details), read whole as text, and stopped
 *   past `MAX_TEXT_OUTPUT_LENGTH`.
 * - `operation`: a write, which may print a line per item it touched (an undo of 100,000 files). Its output only
 *   explains it (its result, its error, `cm` prints them last), so only its start and end are kept, and it is never
 *   stopped for what it prints: stopping a checkin halfway would be worse than any output.
 */
export type CmOutputKind = 'list' | 'answer' | 'operation';

type KindOf = CmOutputKind | ((args: readonly string[]) => CmOutputKind);

/**
 * Every command the app runs, by name (`cm <name>`): a command missing here is refused (`textOutputKind`), so a new one
 * says how it is read before it runs once.
 */
const COMMAND_OUTPUTS: Readonly<Record<string, KindOf>> = {
  // Lists.
  annotate: 'list',
  diff: 'list',
  find: 'list',
  history: 'list',
  ls: 'list',
  // `--header` prints the header alone; without it, every pending change.
  status: (args) => (args.includes('--header') ? 'answer' : 'list'),
  // The machine-readable preview lists what the merge would do; `--merge` merges (its lines read as they arrive), and a
  // plain preview only explains a failure.
  merge: (args) => (args.includes('--machinereadable') && !args.includes('--merge') ? 'list' : 'operation'),
  // `cm changelist` alone lists them.
  changelist: (args) => (args.length === 1 ? 'list' : 'operation'),
  lock: (args) => (args[1] === 'list' ? 'list' : 'operation'),
  profile: (args) => (args[1] === 'list' ? 'list' : 'operation'),
  repository: (args) => (args[1] === 'list' ? 'list' : 'operation'),
  workspace: (args) => (args[1] === 'list' ? 'list' : 'operation'),

  // Answers.
  checkconnection: 'answer',
  fileinfo: 'answer',
  getworkspacefrompath: 'answer',
  // People, not the repository's data, and as lines: no `--format` to stream (a server of 50,000 users prints 1.5 MB).
  listusers: 'answer',
  showacl: 'answer',
  showowner: 'answer',
  version: 'answer',
  whoami: 'answer',
  wi: 'answer',

  // Operations.
  acl: 'operation',
  add: 'operation',
  attribute: 'operation',
  branch: 'operation',
  cat: 'operation',
  changerevisiontype: 'operation',
  changeset: 'operation',
  checkin: 'operation',
  checkout: 'operation',
  codereview: 'operation',
  label: 'operation',
  move: 'operation',
  pull: 'operation',
  push: 'operation',
  remove: 'operation',
  revert: 'operation',
  setowner: 'operation',
  shelveset: 'operation',
  switch: 'operation',
  sync: 'operation',
  undelete: 'operation',
  undo: 'operation',
  update: 'operation',
};

/** What the command prints (`CmOutputKind`); undefined for a command the app doesn't know. */
export function cmOutputKind(args: readonly string[]): CmOutputKind | undefined {
  const kind = COMMAND_OUTPUTS[args[0] ?? ''];
  return typeof kind === 'function' ? kind(args) : kind;
}

/**
 * How `query` and `execute` read the command's text: whole (`answer`) or by its ends (`operation`). Throws for a list,
 * which only a streamed read takes, and for a command no one classified: the mistake shows in the first test or run.
 */
export function textOutputKind(args: readonly string[]): Exclude<CmOutputKind, 'list'> {
  const kind = cmOutputKind(args);
  const command = `cm ${args.slice(0, 2).join(' ')}`;
  if (kind === undefined) throw new Error(`${command} isn't in COMMAND_OUTPUTS (commandOutputs.ts): say how its output is read.`);
  if (kind === 'list') throw new Error(`${command} prints a list: read it as it arrives (queryRecords), never as one string.`);
  return kind;
}
