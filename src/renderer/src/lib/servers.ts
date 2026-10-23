import { serverKind } from '@shared/domain/organizations';

const CLOUD_SERVER = /^(.+)@(cloud|unity)$/i;

/** `acme@cloud` and `acme@unity` are organizations on Unity Cloud; `*@cloud` stands for all of them. */
export function isCloudServer(server: string): boolean {
  return CLOUD_SERVER.test(server);
}

/** `acme@cloud` → `acme`; null for on-premises servers and for `*@cloud`. */
export function cloudOrganization(server: string): string | null {
  const organization = CLOUD_SERVER.exec(server)?.[1];
  return organization && organization !== '*' ? organization : null;
}

/** What each kind of organization is called next to its name: they share Unity Cloud, and may share a name. */
const ORGANIZATION_KINDS = { unityOrganization: 'Unity organization', cloudOrganization: 'Cloud organization' } as const;

/** `acme@unity` → "acme", a Unity organization; `acme@cloud` → "acme", a cloud organization; `local` → this computer. */
export function describeServer(server: string): { label: string; detail?: string } {
  if (server === 'local') return { label: 'This computer' };
  if (server.startsWith('*@')) return { label: 'Any cloud organization', detail: 'Cloud' };
  const kind = serverKind(server);
  const organization = cloudOrganization(server);
  if (organization && (kind === 'unityOrganization' || kind === 'cloudOrganization')) return { label: organization, detail: ORGANIZATION_KINDS[kind] };
  return { label: server };
}

/** A server as a choice in a list, named as the sidebar names it: `This computer`, `acme · Cloud`, `host:8087`. */
export function serverChoiceLabel(server: string): string {
  const { label, detail } = describeServer(server);
  return detail ? `${label} · ${detail}` : label;
}

/** `acme@acme@cloud` → `acme` on `acme@cloud`: repository names never contain `@`, so the server is everything after the first one. */
export function splitRepositorySpec(spec: string): { name: string; server: string } {
  const at = spec.indexOf('@');
  return at === -1 ? { name: spec, server: '' } : { name: spec.slice(0, at), server: spec.slice(at + 1) };
}
