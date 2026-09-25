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

/** `acme@cloud` → organization "acme" on Unity Cloud; `local` → this computer. */
export function describeServer(server: string): { label: string; detail?: string } {
  if (server === 'local') return { label: 'This computer' };
  if (server.startsWith('*@')) return { label: 'Any cloud organization', detail: 'Cloud' };
  const organization = cloudOrganization(server);
  return organization ? { label: organization, detail: 'Cloud' } : { label: server };
}
