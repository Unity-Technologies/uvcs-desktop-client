import type { XlinkTarget } from '@shared/domain/explorer';

/** "Writable xlink" or "Read-only xlink", as every place that shows one names it. */
export function xlinkKind({ writable }: Pick<XlinkTarget, 'writable'>): string {
  return writable ? 'Writable xlink' : 'Read-only xlink';
}

/** The repository an xlink points to, `name@server`, with the folder of it it shows when not the root. */
export function xlinkRepository({ repository, server, path }: XlinkTarget): string {
  const spec = server ? `${repository}@${server}` : repository;
  return path === '/' ? spec : `${spec} ${path}`;
}

/** Where an xlink points, in one line: "Writable xlink to unityGUI@codice@cloud at cs:17361". */
export function xlinkSummary(xlink: XlinkTarget): string {
  return `${xlinkKind(xlink)} to ${xlinkRepository(xlink)} at cs:${xlink.changeset}`;
}
