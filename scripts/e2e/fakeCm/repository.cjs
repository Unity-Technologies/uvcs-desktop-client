// The synthetic repository the fake `cm` answers from: a few objects of each kind, their fields named as `cm` names
// them in `--format` and `find --xml` output. Small on purpose: the smoke test checks that views show, not what.

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
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
const visible = { hidden: 'false' };

const BRANCHES = [
  { id: 3, name: '/main', parent: '', changeset: 4, date: daysAgo(30), comment: 'The main branch', guid: 'aaaaaaaa-0000-0000-0000-000000000003', ...visible, ...common },
  { id: 20, name: '/main/task-001', parent: '/main', changeset: 7, date: daysAgo(10), comment: 'Player movement', guid: 'aaaaaaaa-0000-0000-0000-000000000020', ...visible, ...common },
  { id: 30, name: '/main/task-002', parent: '/main', changeset: 6, date: daysAgo(9), comment: 'Scene lighting', guid: 'aaaaaaaa-0000-0000-0000-000000000030', ...visible, ...common },
];

function changeset(changesetid, branch, parent, days, comment, owner = OWNER) {
  const guid = `cccccccc-0000-0000-0000-00000000000${changesetid}`;
  return { changesetid, id: 100 + changesetid, branch, parent, date: daysAgo(days), comment, guid, ...common, owner };
}

const CHANGESETS = [
  changeset(0, '/main', -1, 30, 'Root dir'),
  changeset(1, '/main', 0, 28, 'Add the project'),
  changeset(2, '/main', 1, 25, 'Add the player'),
  changeset(3, '/main', 2, 20, 'Tune the camera'),
  changeset(4, '/main', 3, 15, 'Release notes'),
  changeset(5, '/main/task-001', 4, 10, 'Player jumps'),
  changeset(6, '/main/task-002', 4, 9, 'Warmer lights'),
  // Incoming: checked in on the workspace's branch after the changeset it loaded.
  changeset(7, '/main/task-001', 5, 8, 'Player runs', 'teammate@example.com'),
];

/** `cm find merge`: none, the branches never merged. */
const MERGES = [];

const LABELS = [
  { id: 50, name: 'BL001', changeset: 2, branch: '/main', date: daysAgo(25), comment: 'First playable', ...common },
  { id: 51, name: 'BL002', changeset: 4, branch: '/main', date: daysAgo(15), comment: 'Second playable', ...common },
];

const SHELVES = [
  { shelveid: 1, id: 70, parent: 4, date: daysAgo(8), comment: 'Half-done menu', guid: 'eeeeeeee-0000-0000-0000-000000000001', ...common },
];

const REVIEWS = [
  { id: 80, title: 'Review player movement', status: 'Under review', assignee: OWNER, targettype: 'branch', target: 'id:20', date: daysAgo(8), ...common },
];

const ATTRIBUTE_TYPES = [{ id: 60, name: 'status', comment: 'Where the task is', date: daysAgo(30), ...common }];

/** Attribute values set on objects (`srcobj`), as `cm find attribute` finds them. */
const ATTRIBUTES = [{ id: 61, name: 'status', value: 'In progress', srcobj: 'br:/main/task-001', date: daysAgo(10), ...common }];

/** `cm repository list`. */
const REPOSITORIES = [{ repid: 1, repname: REPOSITORY, repserver: SERVER, repowner: OWNER }];

/**
 * The workspace's files: `loaded` is the content of the loaded revision (what `cm cat` answers), `onDisk` what the
 * fixture writes when the user changed it, `parent` the revision before the loaded one (revision 200), for a file
 * changed in the loaded changeset rather than added. A file with nothing loaded is private.
 */
const FILES = {
  'README.md': { loaded: '# Demo\n\nA small game.\n' },
  'src/player.cs': {
    loaded: 'class Player {\n  float speed = 4f;\n  void Move() { }\n}\n',
    onDisk: 'class Player {\n  float speed = 5f;\n  void Move() { }\n  void Jump() { }\n}\n',
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
};

/**
 * Revisions by id, for `cm cat revid:N`: the two sides of the one change every `cm diff` reports, and the revision
 * before `src/camera.cs`'s (Files' last change of it).
 */
const REVISIONS = {
  200: FILES['src/camera.cs'].parent,
  201: FILES['src/player.cs'].loaded,
  202: FILES['src/player.cs'].onDisk,
};

/** What `cm diff` finds changed, whatever it compares: its fields named as `--format` names them. */
const DIFFERENCES = [{ status: 'C', path: '"/src/player.cs"', srccmpath: '""', baserevid: 201, revid: 202, type: 'F', repository: `"${REPOSITORY_SPEC}"` }];

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

module.exports = {
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
  REVISIONS,
  SERVER,
  SHELVES,
  WORKSPACE,
};
