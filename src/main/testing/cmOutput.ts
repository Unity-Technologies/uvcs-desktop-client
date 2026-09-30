/**
 * `cm` output as `cm` prints it, for fakes to answer with (`scriptedCm`). Only the fields the parsers read; the
 * repository is `eco@local` unless said otherwise.
 */

export const WORKSPACE_GUID = 'a0411612-d36e-4eca-b9b5-97acad5969ea';

/** `cm getworkspacefrompath --format=…`: the workspace's name and GUID. */
export const WORKSPACE_NAMES = `work\u001f${WORKSPACE_GUID}\u001e\n`;

type SelectorType = 'Branch' | 'Changeset' | 'Label' | 'Shelve';

/** `cm status --header --xml` of a workspace on `name` (a branch unless said otherwise), with changeset `changeset` loaded. */
export function statusHeader(name: string, { changeset = 1, type = 'Branch' as SelectorType } = {}): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus><Status><RepSpec><Server>local</Server><Name>eco</Name></RepSpec><Changeset>${changeset}</Changeset></Status></WorkspaceStatus>
  <WkConfigType>${type}</WkConfigType>
  <WkConfigName>${name}@eco@local</WkConfigName>
</StatusOutput>`;
}

interface ChangeOptions {
  /** `MergesInfo`: set while the change is part of a merge in progress. */
  merge?: string;
  revisionType?: 'enTextFile' | 'enBinaryFile' | 'enDirectory' | 'enSymLink';
}

/** A `<Change>` of `cm status --xml`: `type` is its codes as `cm` joins them (`CO+CH`, `AD`, `PR`). */
export function change(type: string, path: string, { merge = '', revisionType = 'enTextFile' }: ChangeOptions = {}): string {
  return `<Change><Type>${type}</Type><Path>${path}</Path><OldPath /><MergesInfo>${merge}</MergesInfo><SimilarityPerUnit>0</SimilarityPerUnit><Size>3</Size><RevisionType>${revisionType}</RevisionType><LastModified>2026-09-25T08:26:09+02:00</LastModified></Change>`;
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

/** `cm find branch … --xml` finding `name` with object id `id`. */
export function branchFound(name: string, id: number): string {
  return `<?xml version="1.0" encoding="utf-8" ?><PLASTICQUERY><BRANCH><ID>${id}</ID><COMMENT></COMMENT><DATE>2026-09-25T23:16:33+02:00</DATE><OWNER>me</OWNER><NAME>${name}</NAME><PARENT>/main</PARENT><REPOSITORY>eco</REPOSITORY><REPNAME>eco</REPNAME><REPSERVER>local</REPSERVER><TYPE>T</TYPE><CHANGESET>1</CHANGESET><GUID>9b8e2f7a-58f3-4c43-9d83-3c2f1f5c1a10</GUID></BRANCH></PLASTICQUERY>`;
}

/** `cm find changeset … --xml` on `branch`, newest first as asked (`order by changesetid desc`). */
export function changesetsFound(branch: string, ...changesets: { id: number; owner: string }[]): string {
  const records = changesets
    .map(
      ({ id, owner }) =>
        `<CHANGESET><ID>${id + 100}</ID><CHANGESETID>${id}</CHANGESETID><COMMENT>Change ${id}</COMMENT><BRANCH>${branch}</BRANCH><DATE>2026-09-25T23:16:33+02:00</DATE><OWNER>${owner}</OWNER><PARENT>${id - 1}</PARENT><REPNAME>eco</REPNAME><REPSERVER>local</REPSERVER><GUID>6f1c4b1e-8d1c-4f7a-9c2e-2b8f4c1d${String(id).padStart(4, '0')}</GUID></CHANGESET>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="utf-8" ?><PLASTICQUERY>${records}</PLASTICQUERY>`;
}

/** `cm find … --xml` that found nothing. */
export const NOTHING_FOUND = '<?xml version="1.0" encoding="utf-8" ?><PLASTICQUERY></PLASTICQUERY>';

/** `cm find shelve … --xml` finding shelves by number and comment. */
export function shelvesFound(...shelves: { id: number; comment: string }[]): string {
  const records = shelves
    .map(
      ({ id, comment }) =>
        `<SHELVE><ID>${id + 46}</ID><SHELVEID>${id}</SHELVEID><COMMENT>${comment}</COMMENT><DATE>2026-09-25T23:17:30+02:00</DATE><OWNER>me</OWNER><REPOSITORY>eco</REPOSITORY><REPNAME>eco</REPNAME><REPSERVER>local</REPSERVER><PARENT>1</PARENT><GUID>c7558622-b4f1-49eb-9f76-639af4d7e906</GUID></SHELVE>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="utf-8" ?><PLASTICQUERY>${records}</PLASTICQUERY>`;
}

/** What `cm shelveset create` prints for each shelve it made (one per repository: xlinked changes get their own). */
export function shelvesCreated(...shelves: { id: number; repository?: string }[]): string {
  return shelves.map(({ id, repository = 'eco@local' }) => `Created shelve sh:${id}@${repository} (mount:'/')`).join('\n') + '\n';
}

/** A record of `cm diff … --repositorypaths --format=DIFF_FORMAT`: `status` is A, C, D or M; paths as `cm` prints them. */
export function diffRecord(status: string, path: string, { oldPath = '', base = -1, revision = 36, type = 'F', repository = 'eco@local' } = {}): string {
  return `${[status, `"/${path}"`, `"${oldPath && `/${oldPath}`}"`, String(base), String(revision), type, `"${repository}"`].join('\u001f')}\u001e\n`;
}

/** `cm merge … --machinereadable --fieldseparator=…` output, one record per line. */
export function mergeOutput(...records: string[][]): string {
  return records.map((fields) => fields.join('\u001f')).join('\n') + '\n';
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
