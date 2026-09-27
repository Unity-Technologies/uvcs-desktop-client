import type { XlinkTarget } from '@shared/domain/explorer';

/** "Xlink to nervathirdparty@17568", then whether it takes changes, the server and the folder of it shown. */
export function describeXlink(xlink: XlinkTarget): { label: string; detail: string } {
  const folder = xlink.path === '/' ? '' : ` · shows ${xlink.path}`;
  const kind = xlink.writable ? 'Writable: changes under it are checked in to that repository' : 'Read-only';
  return { label: `Xlink to ${xlink.repository}@${xlink.changeset}`, detail: `${kind} · ${xlink.repository}@${xlink.server}, changeset ${xlink.changeset}${folder}` };
}
