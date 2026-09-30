import { FIELD_SEPARATOR, RECORD_SEPARATOR } from '../formatRecords';

/**
 * `cm` output as `cm` prints it, for tests to parse and for `fakeCmClient` to answer with. Only the fields the parsers
 * read; the repository is `eco@local` unless said otherwise.
 */

/** `--format` output as `cm` prints it for a `recordFormat`: fields and records ended by control characters, a line per record. */
export function formatOutput(...records: readonly (string | number)[][]): string {
  return records.map((fields) => `${fields.join(FIELD_SEPARATOR)}${RECORD_SEPARATOR}\n`).join('');
}

/** `cm find <object> --xml` output: one `<element>` per record, each field an element of its own. */
export function findXml(element: string, ...records: Record<string, string | number>[]): string {
  const fields = (record: Record<string, string | number>): string =>
    Object.entries(record)
      .map(([name, value]) => `    <${name}>${escapeXml(String(value))}</${name}>`)
      .join('\n');
  const body = records.map((record) => `  <${element}>\n${fields(record)}\n  </${element}>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8" ?>\n<PLASTICQUERY>\n${body}\n</PLASTICQUERY>\n`;
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** `cm find … --xml` that found nothing. */
export const NOTHING_FOUND = '<?xml version="1.0" encoding="utf-8" ?>\n<PLASTICQUERY>\n</PLASTICQUERY>\n';

export const WORKSPACE_GUID = 'a0411612-d36e-4eca-b9b5-97acad5969ea';

/** `cm getworkspacefrompath --format=…`: the workspace's name and GUID. */
export const WORKSPACE_NAMES = formatOutput(['work', WORKSPACE_GUID]);

type SelectorType = 'Branch' | 'Changeset' | 'Label' | 'Shelve';

interface StatusHeaderOptions {
  changeset?: number;
  type?: SelectorType;
  /** The repository's name, on the `local` server. */
  repository?: string;
}

/** `cm status --header --xml` of a workspace on `name` (a branch unless said otherwise), with changeset `changeset` loaded. */
export function statusHeader(name: string, { changeset = 1, type = 'Branch', repository = 'eco' }: StatusHeaderOptions = {}): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus><Status><RepSpec><Server>local</Server><Name>${repository}</Name></RepSpec><Changeset>${changeset}</Changeset></Status></WorkspaceStatus>
  <WkConfigType>${type}</WkConfigType>
  <WkConfigName>${name}@${repository}@local</WkConfigName>
</StatusOutput>`;
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

/** `cm find branch … --xml` finding branches by name and object id. */
export function branchesFound(...branches: { name: string; id: number }[]): string {
  return findXml(
    'BRANCH',
    ...branches.map(({ name, id }) => ({
      ID: id,
      COMMENT: '',
      DATE: '2026-09-25T23:16:33+02:00',
      OWNER: 'me',
      NAME: name,
      PARENT: '/main',
      REPOSITORY: 'eco',
      REPNAME: 'eco',
      REPSERVER: 'local',
      TYPE: 'T',
      CHANGESET: 1,
      GUID: guidOf('9b8e2f7a-58f3-4c43-9d83-3c2f1f5c', id),
    })),
  );
}

/** `cm find branch … --xml` finding `name` with object id `id`. */
export function branchFound(name: string, id: number): string {
  return branchesFound({ name, id });
}

/** `cm find changeset … --xml` on `branch`, newest first as asked (`order by changesetid desc`). */
export function changesetsFound(branch: string, ...changesets: { id: number; owner: string }[]): string {
  return findXml(
    'CHANGESET',
    ...changesets.map(({ id, owner }) => ({
      ID: id + 100,
      CHANGESETID: id,
      COMMENT: `Change ${id}`,
      BRANCH: branch,
      DATE: '2026-09-25T23:16:33+02:00',
      OWNER: owner,
      PARENT: id - 1,
      REPNAME: 'eco',
      REPSERVER: 'local',
      GUID: guidOf('6f1c4b1e-8d1c-4f7a-9c2e-2b8f4c1d', id),
    })),
  );
}

/** `cm find shelve … --xml` finding shelves by number and comment. */
export function shelvesFound(...shelves: { id: number; comment: string }[]): string {
  return findXml(
    'SHELVE',
    ...shelves.map(({ id, comment }) => ({
      ID: id + 46,
      SHELVEID: id,
      COMMENT: comment,
      DATE: '2026-09-25T23:17:30+02:00',
      OWNER: 'me',
      REPOSITORY: 'eco',
      REPNAME: 'eco',
      REPSERVER: 'local',
      PARENT: 1,
      GUID: guidOf('c7558622-b4f1-49eb-9f76-639af4d7', id),
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

/** `cm ls <paths> --tree=… --xml` listing items of `repository`. */
export function treeListing(repository: string, ...paths: string[]): string {
  const items = paths
    .map(
      (path) =>
        `<LsItem><Status>Controlled</Status><Name>${path.split('/').pop()}</Name><WkPath>/${path}</WkPath><Type>txt</Type><Changeset>3</Changeset><Repository>rep:${repository}</Repository><RevId>40</RevId><ItemId>30</ItemId></LsItem>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?><LsResults><LsItems>${items}</LsItems></LsResults>`;
}
