// The merge the fake previews: /main/task-002 into /main/task-001 on the server, as `cm merge --machinereadable
// --printcontributors` prints it. Its files live in a folder of their own (`Assets/Lighting`), which the workspace's
// files (`repository.cjs`) don't have: a conflict that needs the user, one that merges automatically, and more
// changes to apply than the merge page's list shows at once. Their versions are listed by `cm ls --tree=cs:N` and
// read by `cm cat`, as the merge page reads them.
const { createHash } = require('node:crypto');
const { formatRecords, optionValue } = require('./format.cjs');
const { OWNER, REPOSITORY_SPEC } = require('./repository.cjs');

const SOURCE = { branch: '/main/task-002', changeset: 6 };
const DESTINATION = { branch: '/main/task-001', changeset: 7 };
const BASE = { branch: '/main', changeset: 4 };
const FOLDER = 'Assets/Lighting';

const probe = (number, intensity) => `%YAML 1.1\n--- !u!218 &1\nLightProbes:\n  m_Name: Probe${number}\n  m_Intensity: ${intensity}\n`;
const sun = (intensity, color) => `class Sun {\n  float intensity = ${intensity};\n  Color color = ${color};\n  bool shadows = true;\n}\n`;
const sky = (exposure, tint) => `class Sky {\n  float exposure = ${exposure};\n  float rotation = 0f;\n  float haze = 0.2f;\n  float stars = 1f;\n  Color tint = ${tint};\n}\n`;

/**
 * Each file by its path, with its content at the base, the source and the destination (undefined where it isn't there)
 * and how the preview lists it. Sun.cs changes one line on both sides: a conflict for the user. Sky.cs changes
 * different lines: a conflict that merges automatically. The probes change or arrive on the source alone.
 */
const FILES = [
  { path: 'Sun.cs', kind: 'conflict', versions: [sun('1f', 'Color.white'), sun('1.2f', 'Color.white'), sun('0.8f', 'Color.white')] },
  { path: 'Sky.cs', kind: 'conflict', versions: [sky('1f', 'Color.blue'), sky('1.5f', 'Color.blue'), sky('1f', 'Color.cyan')] },
  ...paddedNumbers(6).map((number) => ({ path: `Probe${number}.asset`, kind: 'changed', versions: [probe(number, 1), probe(number, 2), probe(number, 1)] })),
  ...paddedNumbers(24).map((number) => ({ path: `Baked/Probe${number}.asset`, kind: 'added', versions: [undefined, probe(number, 1), undefined] })),
].map((file, index) => ({ ...file, path: `${FOLDER}/${file.path}`, itemId: 500 + index, revisionIds: [1000 + index * 3, 1001 + index * 3, 1002 + index * 3] }));

function paddedNumbers(count) {
  return Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, '0'));
}

/** The contributors' changesets in the order each file keeps its versions. */
const CHANGESETS = [BASE.changeset, SOURCE.changeset, DESTINATION.changeset];

/** Whether `cm merge <source> --to=<destination>` is this merge. */
function isFakeMerge(source, destination) {
  return source === SOURCE.branch && destination === DESTINATION.branch;
}

/** The preview's records, as `cm merge … --machinereadable --printcontributors` prints them, with its separators. */
function mergePreview(args) {
  if (!args.includes('--machinereadable') || !args.includes('--printcontributors')) throw new Error('The fake cm previews a merge only --machinereadable --printcontributors');
  const [field, end] = [optionValue(args, 'fieldseparator') ?? ' ', optionValue(args, 'endlineseparator') ?? ''];
  const contributor = (role, { branch, changeset }) => ['CONTRIBUTOR', role, changeset, `cs:${changeset}@${REPOSITORY_SPEC}`, branch];
  const records = [
    contributor('SRC', SOURCE),
    contributor('DST', DESTINATION),
    contributor('BASE', BASE),
    ...FILES.map(({ path, kind, itemId }) => {
      if (kind === 'conflict') return ['FILE_CONFLICT', `/${path}`, BASE.changeset, SOURCE.changeset, DESTINATION.changeset, itemId];
      if (kind === 'changed') return ['FILE_SRC', `/${path}`, BASE.changeset, SOURCE.changeset, itemId];
      return ['APPLY', 'ADD', `/${path}`];
    }),
  ];
  return records.map((fields) => `${fields.join(field)}${end}\n`).join('');
}

/** The file's version at `changeset`, as its index in `versions`; -1 at any other changeset. */
function versionIndex(changeset) {
  return CHANGESETS.indexOf(Number(changeset));
}

/** The folders under `FOLDER`, itself included, each by its path. */
const FOLDERS = [FOLDER, `${FOLDER}/Baked`];

/** Whether `cm ls <path>` is of the merge's files: its folder or what it holds. */
function listsMergeFiles(args) {
  const path = args[0]?.replace(/^\//, '');
  return path !== undefined && (path === FOLDER || path.startsWith(`${FOLDER}/`));
}

/**
 * `cm ls <paths…> --tree=cs:N --format=…`: each file named, or a folder and the files right under it, at the
 * changeset (one of the merge's three): the conflicts the preview completes, a change's versions the page diffs.
 */
function mergeListing(args) {
  const tree = /^cs:(\d+)$/.exec(optionValue(args, 'tree') ?? '')?.[1];
  const format = optionValue(args, 'format');
  if (tree === undefined || versionIndex(tree) < 0 || !format) throw new Error('The fake cm lists the merge\'s files only --tree=cs:<one of its changesets> and --format');
  const at = versionIndex(tree);
  const records = args.filter((arg) => !arg.startsWith('--')).flatMap((arg) => {
    const path = arg.replace(/^\//, '');
    if (FOLDERS.includes(path)) return [folderRecord(path, '.'), ...childrenAt(path, at)];
    const file = FILES.find((each) => each.path === path && each.versions[at] !== undefined);
    if (!file) throw new Error(`The path ${arg} is not in the tree cs:${tree}`);
    return [fileRecord(file, at)];
  });
  return formatRecords(format, records);
}

function childrenAt(folder, at) {
  const folders = FOLDERS.filter((each) => each.startsWith(`${folder}/`) && !each.slice(folder.length + 1).includes('/'));
  const files = FILES.filter((file) => file.versions[at] !== undefined && file.path.slice(0, file.path.lastIndexOf('/')) === folder);
  return [...folders.map((path) => folderRecord(path, path.split('/').pop())), ...files.map((file) => fileRecord(file, at))];
}

const COMMON = { date: '2026-09-20T12:00:00.0000000+02:00', checkout: '', owner: OWNER, repspec: `rep:${REPOSITORY_SPEC}`, symlinktarget: '' };

function folderRecord(path, name) {
  return { ...COMMON, name, wkpath: `/${path}`, path: `/${path}`, type: 'dir', size: 0, changeset: BASE.changeset, branch: BASE.branch, revid: 900, parentrevid: -1, itemid: 499, hash: '' };
}

/** A file at a version: the revision of the changeset that last changed it there (the destination's kept the base's). */
function fileRecord(file, at) {
  const content = Buffer.from(file.versions[at], 'utf8');
  const revision = file.versions[at] === file.versions[0] ? 0 : at;
  return {
    ...COMMON,
    name: file.path.split('/').pop(),
    wkpath: `/${file.path}`,
    path: `/${file.path}`,
    type: 'txt',
    size: content.length,
    changeset: CHANGESETS[revision],
    branch: [BASE, SOURCE, DESTINATION][revision].branch,
    revid: file.revisionIds[revision],
    parentrevid: revision === 0 ? -1 : file.revisionIds[0],
    itemid: file.itemId,
    hash: createHash('md5').update(content).digest('base64'),
  };
}

/**
 * A version `cm cat` reads, by its revision (`revid:1001@…`), its item at a changeset (`itemid:500#cs:6@…`) or its path
 * there (`serverpath:/Assets/Lighting/Sun.cs#cs:6`); undefined for any other.
 */
function mergeVersion(spec) {
  const revision = /^revid:(\d+)/.exec(spec)?.[1];
  if (revision !== undefined) {
    const file = FILES.find((each) => each.revisionIds.includes(Number(revision)));
    return file?.versions[file.revisionIds.indexOf(Number(revision))];
  }
  const [, path, pathChangeset] = /^serverpath:\/(.+)#cs:(\d+)/.exec(spec) ?? [];
  if (path !== undefined) return FILES.find((each) => each.path === path)?.versions[versionIndex(pathChangeset)];
  const [, item, changeset] = /^itemid:(\d+)#cs:(\d+)/.exec(spec) ?? [];
  return FILES.find((each) => each.itemId === Number(item))?.versions[versionIndex(changeset)];
}

module.exports = { isFakeMerge, listsMergeFiles, mergeListing, mergePreview, mergeVersion };
