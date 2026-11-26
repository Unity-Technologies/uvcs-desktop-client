import { isUnityOrganization } from '@shared/domain/organizations';
import { serverKey } from '@shared/domain/repository';
import { parseOrganizationId, type OrganizationId } from '@shared/domain/stableIds';
import type { CmClient } from './CmClient';
import { organizationIdArgs } from './organizationIds';

/**
 * Each Unity organization's id by its name (`acme@unity`), asked of `cm` once per name for the session: an id never
 * changes, and a name renamed meanwhile names no other organization, as no other organization can ever take it. A
 * local read (`organizationIdArgs`). Any failure is kept for the session too: an organization `cm` doesn't know yet
 * (no sign-in to it on this machine) has no id until the next session; a server that isn't a Unity organization has
 * none.
 */
export class UnityOrganizationIds {
  /** By `serverKey`: `cm` takes an organization's name in any case. */
  private readonly ids = new Map<string, Promise<OrganizationId | undefined>>();

  constructor(private readonly cm: Pick<CmClient, 'query'>) {}

  idOf(server: string): Promise<OrganizationId | undefined> {
    if (!isUnityOrganization(server)) return Promise.resolve(undefined);
    const key = serverKey(server);
    const known = this.ids.get(key);
    if (known) return known;
    const read = this.cm.query(organizationIdArgs(server), { anyDirectory: true }).then(parseOrganizationId, () => undefined);
    this.ids.set(key, read);
    return read;
  }

  /** Forgets every answer: the profiles changed, and `cm` may know an organization by a new name now. */
  forget(): void {
    this.ids.clear();
  }
}
