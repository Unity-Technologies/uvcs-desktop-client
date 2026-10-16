import { FIELD_SEPARATOR, RECORD_SEPARATOR, type RecordLayout } from '../formatRecords';
import { findQueryArgs } from '../findQuery';
import { TREE_ITEMS } from '../treeItems';
import { FOUND_BRANCHES, FOUND_CHANGESETS, FOUND_SHELVES, type FoundObjects } from '../foundObjects';

/**
 * `cm` output as `cm` prints it, for tests to parse and for `fakeCmClient` to answer with. Only the fields the parsers
 * read; the repository is `eco@local` unless said otherwise.
 */

/** `--format` output as `cm` prints it for a `recordFormat`: fields and records ended by control characters, a line per record. */
export function formatOutput(...records: readonly (string | number)[][]): string {
  return records.map((fields) => `${fields.join(FIELD_SEPARATOR)}${RECORD_SEPARATOR}\n`).join('');
}

/** The command line of `cm find` of the objects `found` reads that `query` keeps, as `fakeCmClient` records it. */
export function foundLine(found: FoundObjects<unknown>, query: string): string {
  return findQueryArgs(found, query).join(' ');
}

/**
 * Output printed through a record layout's `--format` (`findArgs`, `TREE_ITEM_FORMAT`): each item's fields in the order
 * it prints them, a field left out printed empty.
 */
export function recordsOutput<Field extends string>(layout: RecordLayout<unknown, Field>, ...objects: Partial<Record<Field, string | number>>[]): string {
  return formatOutput(...objects.map((object) => layout.fields.map((field) => object[field] ?? '')));
}

export const WORKSPACE_GUID = 'a0411612-d36e-4eca-b9b5-97acad5969ea';

/** `cm getworkspacefrompath --format=…`: the workspace's name and GUID. */
export const WORKSPACE_NAMES = formatOutput(['work', WORKSPACE_GUID]);

type SelectorType = 'Branch' | 'Changeset' | 'Label' | 'Shelve';

interface StatusHeaderOptions {
  changeset?: number;
  type?: SelectorType;
  /** The repository's name, on `server`. */
  repository?: string;
  /** As `cm status --xml` prints it: `local` unless said otherwise; a Unity organization by its id (`UNITY_ORGANIZATION.byId`). */
  server?: string;
}

/** `cm status --header --xml` of a workspace on `name` (a branch unless said otherwise), with changeset `changeset` loaded. */
export function statusHeader(name: string, { changeset = 1, type = 'Branch', repository = 'eco', server = 'local' }: StatusHeaderOptions = {}): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus><Status><RepSpec><Server>${server}</Server><Name>${repository}</Name></RepSpec><Changeset>${changeset}</Changeset></Status></WorkspaceStatus>
  <WkConfigType>${type}</WkConfigType>
  <WkConfigName>${name}@${repository}@${server}</WkConfigName>
</StatusOutput>`;
}

/**
 * A Unity Cloud organization's server by the name people use, which `cm` prints and takes everywhere (`byName`), and
 * by the internal id UVCS keeps it under (`byId`), which `cm status --xml`, `cm history --xml` and the workspace's
 * `.plastic/plastic.selector` hold instead.
 */
export const UNITY_ORGANIZATION = { byName: 'AcmeStudio@unity', byId: '2398571046213@cloud' } as const;

/** `cm status --header --machinereadable --fieldseparator=|`: the loaded changeset, the repository and its server by name. */
export function machineReadableStatusHeader(repository: string, server: string, changeset = 1): string {
  return `STATUS|${changeset}|${repository}|${server}\n`;
}

interface ChangeOptions {
  /** `MergesInfo`: set while the change is part of a merge in progress, as `cm` writes it (` (Merge from 12)`). */
  merge?: string;
  /** `OldPath`: where a moved item was. */
  oldPath?: string;
  revisionType?: 'enTextFile' | 'enBinaryFile' | 'enDirectory' | 'enSymLink';
  lastModified?: string;
}

/** A `<Change>` of `cm status --xml`: `type` is its codes as `cm` joins them (`CO+CH`, `AD`, `PR`). */
export function change(
  type: string,
  path: string,
  { merge = '', oldPath = '', revisionType = 'enTextFile', lastModified = '2026-09-25T08:26:09+02:00' }: ChangeOptions = {},
): string {
  return `<Change><Type>${type}</Type><Path>${path}</Path><OldPath>${oldPath}</OldPath><MergesInfo>${merge}</MergesInfo><SimilarityPerUnit>0</SimilarityPerUnit><Size>3</Size><RevisionType>${revisionType}</RevisionType><LastModified>${lastModified}</LastModified></Change>`;
}

/** `cm status --xml` listing `changes` (in the default changelist). */
export function pendingStatus(...changes: string[]): string {
  return `<?xml version="1.0" encoding="utf-8"?><StatusOutput><WorkspaceStatus><Status><Changeset>1</Changeset></Status></WorkspaceStatus><Changes>${changes.join('')}</Changes></StatusOutput>`;
}

/** `cm status --xml --changelists`: each changelist with its changes. */
export function pendingStatusInChangelists(changelists: { name: string; description?: string; changes: string[] }[]): string {
  const lists = changelists
    .map(({ name, description = '', changes }) => `<Changelist><Name>${name}</Name><Description>${description}</Description><Changes>${changes.join('')}</Changes></Changelist>`)
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?><StatusOutput><WorkspaceStatus><Status><Changeset>1</Changeset></Status></WorkspaceStatus><Changelists>${lists}</Changelists></StatusOutput>`;
}

/** A GUID whose last digits are `id`, so each object's is its own. */
const guidOf = (prefix: string, id: number): string => `${prefix}${String(id).padStart(4, '0')}`;

/** `cm find branch …` (`FOUND_BRANCHES`) finding branches by name and object id. */
export function branchesFound(...branches: { name: string; id: number }[]): string {
  return recordsOutput(
    FOUND_BRANCHES,
    ...branches.map(({ name, id }) => ({
      id,
      comment: '',
      date: '2026-09-25T23:16:33.0000000+02:00',
      owner: 'me',
      name,
      parent: '/main',
      repname: 'eco',
      repserver: 'local',
      changeset: 1,
      guid: guidOf('9b8e2f7a-58f3-4c43-9d83-3c2f1f5c', id),
    })),
  );
}

/** `cm find branch …` finding `name` with object id `id`. */
export function branchFound(name: string, id: number): string {
  return branchesFound({ name, id });
}

/** `cm find changeset …` (`FOUND_CHANGESETS`) on `branch`, newest first as asked (`order by changesetid desc`). */
export function changesetsFound(branch: string, ...changesets: { id: number; owner: string }[]): string {
  return recordsOutput(
    FOUND_CHANGESETS,
    ...changesets.map(({ id, owner }) => ({
      changesetid: id,
      comment: `Change ${id}`,
      branch,
      date: '2026-09-25T23:16:33.0000000+02:00',
      owner,
      parent: id - 1,
      repname: 'eco',
      repserver: 'local',
      guid: guidOf('6f1c4b1e-8d1c-4f7a-9c2e-2b8f4c1d', id),
    })),
  );
}

/** `cm find shelve …` (`FOUND_SHELVES`) finding shelves by number and comment. */
export function shelvesFound(...shelves: { id: number; comment: string }[]): string {
  return recordsOutput(
    FOUND_SHELVES,
    ...shelves.map(({ id, comment }) => ({
      shelveid: id,
      comment,
      date: '2026-09-25T23:17:30.0000000+02:00',
      owner: 'me',
      repname: 'eco',
      repserver: 'local',
      parent: 1,
      guid: guidOf('c7558622-b4f1-49eb-9f76-639af4d7', id),
    })),
  );
}

/** What `cm shelveset create` prints for each shelve it made (one per repository: xlinked changes get their own). */
export function shelvesCreated(...shelves: { id: number; repository?: string }[]): string {
  return shelves.map(({ id, repository = 'eco@local' }) => `Created shelve sh:${id}@${repository} (mount:'/')`).join('\n') + '\n';
}

/** A record of `cm diff … --repositorypaths --format=DIFF_FORMAT`: `status` is A, C, D or M; paths as `cm` prints them. */
export function diffRecord(status: string, path: string, { oldPath = '', base = -1, revision = 36, type = 'F', repository = 'eco@local' } = {}): string {
  return formatOutput([status, `"/${path}"`, `"${oldPath && `/${oldPath}`}"`, base, revision, type, `"${repository}"`]);
}

/** `cm merge … --machinereadable --fieldseparator=…` output: one record per line, fields apart by the separator given. */
export function mergeOutput(...records: string[][]): string {
  return records.map((fields) => fields.join(FIELD_SEPARATOR)).join('\n') + '\n';
}

/** `cm ls <paths> --tree=… --format=TREE_ITEM_FORMAT` listing text files of `repository`, by their server paths. */
export function treeListing(repository: string, ...paths: string[]): string {
  return recordsOutput(
    TREE_ITEMS,
    ...paths.map((path) => ({ name: path.split('/').pop(), wkpath: `/${path}`, type: 'txt', size: 3, changeset: 3, repspec: `rep:${repository}`, revid: 40, itemid: 30 })),
  );
}

type AclOutputCategory = 'Allowed' | 'Denied' | 'Override Allowed' | 'Override Denied';

/** One list of `cm showacl --extended`: its creator's spec, its entries by member (each category's names as cm prints them), its parents. */
export interface AclOutputLevel {
  creator: string;
  entries?: Record<string, Partial<Record<AclOutputCategory, string>>>;
  inherited?: AclOutputLevel[];
}

/** `cm showacl <spec> --extended` output, indented as cm 11 prints it (`ExtendedAclDisplayInfo`). */
export function extendedAclOutput(level: AclOutputLevel, indent = 2): string {
  const pad = (extra: number) => ' '.repeat(indent + extra);
  const lines = [`${pad(0)}ACL: ${indent}`, `${pad(2)}Creator ${level.creator}`];
  const entries = Object.entries(level.entries ?? {});
  if (entries.length > 0) lines.push(`${pad(2)}Entries`);
  for (const [member, categories] of entries) {
    lines.push(`${pad(3)}${member}:`);
    for (const [category, names] of Object.entries(categories)) lines.push(`${pad(5)}${category}:`, `${pad(6)}${names}`);
  }
  const inherited = level.inherited ?? [];
  if (inherited.length > 0) lines.push(`${pad(2)}Inherited`, ...inherited.map((parent) => extendedAclOutput(parent, indent + 4).trimEnd()));
  return `${lines.join('\n')}\n`;
}

/** An item of `cm ls --tree -R --format` (`treeListingArgs`): its workspace path and what tells its revision. */
export interface ListedRecord {
  path: string;
  type?: 'dir' | 'txt' | 'bin' | 'xlink';
  size?: number;
  revid: number;
  hash?: string;
  repository?: string;
  changeset?: number;
  parentrevid?: number;
}

/** `cm ls <folder> --tree=<point> -R --format=…` output as `treeListingArgs` asks it: server paths, `rep:` specs. */
export function treeListingOutput(...items: ListedRecord[]): string {
  return formatOutput(
    ...items.map(({ path, type = 'bin', size = 0, revid, hash = `hash${revid}==`, repository = 'eco@local', changeset = 1, parentrevid = -1 }) => [
      `/${path}`,
      type,
      size,
      revid,
      hash,
      `rep:${repository}`,
      changeset,
      parentrevid,
    ]),
  );
}

/** An item of a workspace's `cm ls <folder>`: the revision it was loaded from (its size and hash), or a checkout's -1. */
export interface WorkspaceListedRecord {
  path: string;
  revid: number;
  size: number;
  hash: string;
  repository?: string;
  checkedOut?: boolean;
}

/**
 * A workspace's `cm ls <folder> --format=TREE_ITEM_FORMAT` as `cm` prints it: the folder itself as `.`, `{wkpath}`s
 * relative with the OS's separators, and each file's `{size}` and `{hash}` its loaded revision's, never the disk's (a
 * checkout has no revision).
 */
export function workspaceListingOutput(folder: string, ...items: WorkspaceListedRecord[]): string {
  const item = ({ path, revid, size, hash, repository = 'eco@local', checkedOut = false }: WorkspaceListedRecord) => ({
    name: path.split(/[\\/]/).pop(),
    wkpath: path,
    type: 'bin',
    size,
    'date:o': '2026-10-15T14:24:03.0000000+02:00',
    checkout: checkedOut ? 'CO' : '',
    changeset: checkedOut ? -1 : 21,
    branch: '/main',
    owner: 'me',
    revid: checkedOut ? -1 : revid,
    parentrevid: revid - 1,
    repspec: `rep:${repository}`,
    itemid: revid + 1000,
    hash,
  });
  return recordsOutput(TREE_ITEMS, { name: '.', wkpath: folder, type: 'dir', size: 0, revid: 1 }, ...items.map(item));
}
