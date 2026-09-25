import type { XlinkTarget } from '@shared/domain/explorer';

/**
 * `cm ls` lists an xlink as a directory named after its target:
 * `02nervathirdparty -> wxlink -> / 17568@nervathirdparty@ [relative] codice@cloud`
 * (writable `wxlink` or read-only `xlink`, then the path in the target, the changeset and the repository; a relative
 * xlink leaves the server out of the spec and names it after `[relative]`).
 */
const XLINK_NAME = /^.* -> (w?xlink) -> (.*) (\d+)@(.+?)@(\S*)(?: \[relative\])?(?: (\S+))?$/;

/** The target of an xlinked directory from its `cm ls` name; undefined for any other item. */
export function parseXlinkName(name: string): XlinkTarget | undefined {
  const match = XLINK_NAME.exec(name);
  if (!match) return undefined;
  const [, kind, path, changeset, repository, server, relativeServer] = match;
  return {
    writable: kind === 'wxlink',
    path: path!,
    changeset: Number(changeset),
    repository: repository!,
    server: server || relativeServer || '',
  };
}
