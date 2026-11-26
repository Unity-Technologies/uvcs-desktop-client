// The synthetic repository the fake `cm` answers from: a few objects of each kind, their fields named as `cm` names
// them in `--format` output. Small on purpose: the smoke test checks that views show, not what. A few lists, and one
// diff, are longer than the window (`LONGER_THAN_THE_WINDOW`), so content that can't scroll is cut off and the
// smoke test's cut-off check fails (scripts/e2e/README.md "Cut-off content").

const REPOSITORY = 'demo';
const SERVER = 'local';
const REPOSITORY_SPEC = `${REPOSITORY}@${SERVER}`;
const OWNER = 'tester@example.com';

/** The workspace the smoke test opens: a real folder (`scripts/e2e/workspaceFixture.mjs`), passed in by the test. */
const WORKSPACE = {
  name: 'demo',
  path: process.env.UVCS_FAKE_WORKSPACE ?? '',
  guid: '0b0e2b5c-5d5e-4f7a-9a51-5b8e4c1d2e3f',
  branch: '/main/task-001',
  changeset: 5,
};

const common = { owner: OWNER, repname: REPOSITORY, repserver: SERVER };

/** Dates follow today, so views filtered to the last weeks (`date >= …`) keep showing the objects. */
function daysAgo(days) {
  return roundTripDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

/** A date as `--dateformat=o` prints it: local time, seven fraction digits, the UTC offset (`…T10:00:00.0000000+02:00`). */
function roundTripDate(date) {
  const two = (value) => String(value).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const zone = `${offset >= 0 ? '+' : '-'}${two(Math.floor(Math.abs(offset) / 60))}:${two(Math.abs(offset) % 60)}`;
  const day = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
  return `${day}T${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}0000${zone}`;
}
const visible = { hidden: 'false' };
/** How many items make a list longer than the smoke test's window (1400×880) at the app's row heights. */
const LONGER_THAN_THE_WINDOW = 40;
/** `1…count`, for the items that make a list long. */
const numbered = (count) => Array.from({ length: count }, (_, index) => index + 1);

const BRANCHES = [
  { id: 3, name: '/main', parent: '', changeset: 4, date: daysAgo(30), comment: 'The main branch', guid: 'aaaaaaaa-0000-0000-0000-000000000003', ...visible, ...common },
  { id: 20, name: '/main/task-001', parent: '/main', changeset: 7, date: daysAgo(10), comment: 'Player movement: https://acme.atlassian.net/browse/VCS-12', guid: 'aaaaaaaa-0000-0000-0000-000000000020', ...visible, ...common },
  { id: 30, name: '/main/task-002', parent: '/main', changeset: 6, date: daysAgo(9.95), comment: 'Scene lighting', guid: 'aaaaaaaa-0000-0000-0000-000000000030', ...visible, ...common },
];

function changeset(changesetid, branch, parent, days, comment, owner = OWNER) {
  const guid = `cccccccc-0000-0000-0000-${String(changesetid).padStart(12, '0')}`;
  return { changesetid, id: 100 + changesetid, branch, parent, date: daysAgo(days), comment, guid, ...common, owner };
}

const CHANGESETS = [
  changeset(0, '/main', -1, 30, 'Root dir'),
  changeset(1, '/main', 0, 28, 'Add the project'),
  changeset(2, '/main', 1, 25, 'Add the player'),
  // References a chip opens (the smoke's "A comment's chips open what they name"): a changeset, and review 80's change request.
  changeset(3, '/main', 2, 20, 'Tune the camera after cs:2, as [apply-change:ffffffff] asked'),
  changeset(4, '/main', 3, 15, 'Release notes'),
  changeset(5, '/main/task-001', 4, 10, 'VCS-12 Player jumps\n\nAlso fixes VCS-13 and VCS-99, as https://acme.atlassian.net/browse/VCS-14 asked.'),
  // The scene's lights tuned step by step: a list of changesets longer than the window, older than the lists' first rows.
  ...numbered(LONGER_THAN_THE_WINDOW).map((step) => changeset(1000 + step, '/main/task-002', step === 1 ? 4 : 999 + step, 9.9 - step / 50, `Lighting pass ${step}`)),
  changeset(6, '/main/task-002', 1000 + LONGER_THAN_THE_WINDOW, 9, 'Warmer lights'),
  // Incoming: checked in on the workspace's branch after the changeset it loaded.
  changeset(7, '/main/task-001', 5, 8, 'Player runs', 'teammate@example.com'),
];

/** `cm find merge`: none, the branches never merged. */
const MERGES = [];

const LABELS = [
  { id: 50, name: 'BL001', changeset: 2, branch: '/main', date: daysAgo(25), comment: 'First playable', ...common },
  { id: 51, name: 'BL002', changeset: 4, branch: '/main', date: daysAgo(15), comment: 'Second playable', ...common },
  // A build of each lighting pass, labeled just after it: a list of labels longer than the window.
  ...numbered(LONGER_THAN_THE_WINDOW).map((pass) => ({ id: 500 + pass, name: `LIGHTING-${String(pass).padStart(3, '0')}`, changeset: 1000 + pass, branch: '/main/task-002', date: daysAgo(9.9 - pass / 50 - 0.01), comment: `Build of lighting pass ${pass}`, ...common })),
];

const SHELVES = [
  { shelveid: 1, id: 70, parent: 4, date: daysAgo(8), comment: 'Half-done menu', guid: 'eeeeeeee-0000-0000-0000-000000000001', ...common },
];

/**
 * A merge request's two fields as `cm find review` prints them (`{mergerequeststatus}`, `{destination}`); a plain
 * code review prints `None` and nothing. A query's condition names `mergerequeststatus` too.
 */
const mergeRequest = (state, destination) => ({ mergerequeststatus: state, destination: `br:${destination}` });
const plainReview = { mergerequeststatus: 'None', destination: '' };

const REVIEWS = [
  {
    id: 80,
    title: 'Review player movement',
    codereviewstatus: 'Under review',
    reviewers: `${OWNER}:Under review`,
    comments: 3,
    unresolvedissues: 1,
    targettype: 'branch',
    target: 'id:20',
    date: daysAgo(8),
    modifieddate: daysAgo(2),
    ...mergeRequest('Open', '/main'),
    ...common,
  },
  {
    id: 81,
    title: 'Review the HUD',
    codereviewstatus: 'Rework required',
    reviewers: 'ana.diaz@acme.com:Reviewed,bob.smith@acme.com:Rework required,Developers:Under review,eva.lopez@acme.com:Reviewed',
    comments: 14,
    unresolvedissues: 0,
    targettype: 'branch',
    target: 'id:20',
    date: daysAgo(6),
    modifieddate: daysAgo(1),
    ...plainReview,
    ...common,
  },
  {
    id: 82,
    title: 'Scene lighting',
    codereviewstatus: 'Under review',
    reviewers: '',
    comments: 0,
    unresolvedissues: 0,
    targettype: 'branch',
    target: 'id:30',
    date: daysAgo(5),
    modifieddate: daysAgo(5),
    ...mergeRequest('Draft', '/main'),
    ...common,
  },
  {
    id: 83,
    title: 'First playable',
    codereviewstatus: 'Reviewed',
    reviewers: 'ana.diaz@acme.com:Reviewed',
    comments: 1,
    unresolvedissues: 0,
    targettype: 'branch',
    target: 'id:30',
    date: daysAgo(20),
    modifieddate: daysAgo(15),
    ...mergeRequest('Merged', '/main'),
    ...common,
  },
];

/**
 * Review 80's conversation, as `cm find changereviewcomment` prints it: its description, a change request on a line, its
 * reply, a merge request's state move and destination change, a status.
 */
const REVIEW_COMMENT_FIELDS = { owner: OWNER, parent: -1, revisionid: -1, itemid: '', path: '', location: -1, changeset: -1, appliedinchangeset: -1, reviewid: 80 };
const REVIEW_COMMENTS = [
  { ...REVIEW_COMMENT_FIELDS, id: 90, guid: 'ffffffff-0000-0000-0000-000000000090', date: daysAgo(8), modifieddate: daysAgo(8), type: 'timeline', comment: '[description]Makes the player **jump**.' },
  { ...REVIEW_COMMENT_FIELDS, id: 91, guid: 'ffffffff-0000-0000-0000-000000000091', date: daysAgo(7), modifieddate: daysAgo(7), type: 'change', comment: 'Jump only when grounded.', revisionid: 12, itemid: 7, path: '/src/player.cs', location: 0 },
  { ...REVIEW_COMMENT_FIELDS, id: 92, guid: 'ffffffff-0000-0000-0000-000000000092', date: daysAgo(6), modifieddate: daysAgo(6), type: 'comment', comment: 'On it.', parent: 91, revisionid: 12, itemid: 7, path: '/src/player.cs', location: 0 },
  // A merge request's notes: made ready for review, then pointed at /main (from /main/task-002, by branch ids).
  { ...REVIEW_COMMENT_FIELDS, id: 94, guid: 'ffffffff-0000-0000-0000-000000000094', date: daysAgo(5), modifieddate: daysAgo(5), type: 'timeline', comment: '[mergerequest-status-draft-to-open]' },
  { ...REVIEW_COMMENT_FIELDS, id: 95, guid: 'ffffffff-0000-0000-0000-000000000095', date: daysAgo(4), modifieddate: daysAgo(4), type: 'timeline', comment: '[changed-mergerequest-destination]30;3' },
  { ...REVIEW_COMMENT_FIELDS, id: 93, guid: 'ffffffff-0000-0000-0000-000000000093', date: daysAgo(2), modifieddate: daysAgo(2), type: 'timeline', comment: '[status-rework-required]One change first.' },
];

const ATTRIBUTE_TYPES = [{ id: 60, name: 'status', comment: 'Where the task is', date: daysAgo(30), ...common }];

/** Attribute values set on objects (`srcobj`), as `cm find attribute` finds them. */
const ATTRIBUTES = [{ id: 61, name: 'status', value: 'In progress', srcobj: 'br:/main/task-001', date: daysAgo(10), ...common }];

/** `cm repository list`. */
const REPOSITORIES = [{ repid: 1, repname: REPOSITORY, repserver: SERVER, repowner: OWNER, reptype: 'VCS', repguid: '00000000-0000-4000-8000-000000000001' }];

/**
 * The workspace's files: `loaded` is the content of the loaded revision (what `cm cat` answers), `onDisk` what the
 * fixture writes when the user changed it, `parent` the revision before the loaded one (revision 200), for a file
 * changed in the loaded changeset rather than added. A file with nothing loaded is private.
 */
const FILES = {
  'README.md': { loaded: '# Demo\n\nA small game.\n' },
  // Its diff is longer than the window: the edit, then a move for each of the player's states.
  'src/player.cs': {
    loaded: 'class Player {\n  float speed = 4f;\n  void Move() { }\n}\n',
    onDisk: `class Player {\n  float speed = 5f;\n  void Move() { }\n  void Jump() { }\n${numbered(LONGER_THAN_THE_WINDOW).map((state) => `  void State${state}() { }\n`).join('')}}\n`,
  },
  'src/camera.cs': { loaded: 'class Camera {\n  float distance = 10f;\n}\n', parent: 'class Camera {\n  float distance = 8f;\n}\n' },
  // A 3D model, written as text (OBJ) so the fixture stays readable: its diff is the model diff's, which reads the
  // import settings in its .meta beside it, as every model of a Unity project has.
  'Assets/crate.obj.meta': { loaded: 'fileFormatVersion: 2\nguid: 4f1d0c6a2b3e4d5f8a9b0c1d2e3f4a5b\nModelImporter:\n  meshes:\n    globalScale: 1\n    useFileScale: 1\n  animationType: 2\n' },
  'Assets/crate.obj': {
    loaded: 'o Crate\nusemtl Wood\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3 4\n',
    onDisk: 'o Crate\nusemtl Wood_mat\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3 4\n',
  },
  'notes.txt': { onDisk: 'Ideas for the next level.\n' },
  // Levels the user retuned: a list of pending changes longer than the window, after the files the steps click.
  ...Object.fromEntries(numbered(LONGER_THAN_THE_WINDOW).map((level) => [`tests/levels/level-${String(level).padStart(2, '0')}.txt`, { loaded: `level ${level}\n`, onDisk: `level ${level}, harder\n` }])),
  // A sound and its .meta, both changed: the sound's diff is a binary file's (a NUL byte makes it one, `looksBinary`),
  // and its .meta can be shown instead.
  'Assets/hurt.wav': { loaded: 'RIFF\u0000\u0000WAVE\u0001', onDisk: 'RIFF\u0000\u0000WAVE\u0002' },
  'Assets/hurt.wav.meta': {
    loaded: 'fileFormatVersion: 2\nguid: 9a8b7c6d5e4f40312a1b0c9d8e7f6a5b\nAudioImporter:\n  loadInBackground: 0\n',
    onDisk: 'fileFormatVersion: 2\nguid: 9a8b7c6d5e4f40312a1b0c9d8e7f6a5b\nAudioImporter:\n  loadInBackground: 1\n',
  },
};

/**
 * Revisions by id, for `cm cat revid:N`: the two sides of the change every `cm diff` reports, the one revision of the
 * file whose permissions alone changed, and the revision before `src/camera.cs`'s (its `parentrevid` in `tree.cjs`).
 */
const REVISIONS = {
  200: FILES['src/camera.cs'].parent,
  201: FILES['src/player.cs'].loaded,
  202: FILES['src/player.cs'].onDisk,
  203: FILES['README.md'].loaded,
};

/**
 * What `cm diff` finds changed, whatever it compares: its fields named as `--format` names them. README.md changed only
 * its permissions, which `cm` prints with no base revision: it had none set before, as a file checked in from Windows.
 */
const DIFFERENCES = [
  { status: 'C', path: '"/README.md"', srccmpath: '""', baserevid: -1, revid: 203, type: 'F', repository: `"${REPOSITORY_SPEC}"`, srcfsprotection: '""', fsprotection: '"-r--r--r--"', date: `"${daysAgo(3)}"` },
  { status: 'C', path: '"/src/player.cs"', srccmpath: '""', baserevid: 201, revid: 202, type: 'F', repository: `"${REPOSITORY_SPEC}"`, srcfsprotection: '"-rw-r--r--"', fsprotection: '"-rw-r--r--"', date: `"${daysAgo(1)}"` },
];

/** `cm lock list` records, their fields in the order `cm` prints them. */
const LOCKS = [
  {
    repository: REPOSITORY,
    itemId: 90,
    guid: 'dddddddd-0000-0000-0000-000000000090',
    date: daysAgo(7),
    destinationBranch: '/main',
    destinationRevision: 201,
    holderBranch: '/main/task-001',
    holderRevision: 201,
    status: 'Locked',
    owner: OWNER,
    workspace: WORKSPACE.name,
    path: '/src/camera.cs',
  },
];

/** An absolute path's place in the workspace, with forward slashes, or undefined for one outside it. */
function workspacePathOf(path) {
  return path.startsWith(WORKSPACE.path) ? path.slice(WORKSPACE.path.length + 1).replaceAll('\\', '/') : undefined;
}

module.exports = {
  workspacePathOf,
  ATTRIBUTES,
  ATTRIBUTE_TYPES,
  BRANCHES,
  CHANGESETS,
  DIFFERENCES,
  FILES,
  LABELS,
  LOCKS,
  MERGES,
  OWNER,
  REPOSITORIES,
  REPOSITORY,
  REPOSITORY_SPEC,
  REVIEWS,
  REVIEW_COMMENTS,
  REVISIONS,
  SERVER,
  SHELVES,
  WORKSPACE,
};
