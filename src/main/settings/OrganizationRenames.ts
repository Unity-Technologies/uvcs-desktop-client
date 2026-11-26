import { serverKey } from '@shared/domain/repository';
import type { OrganizationId } from '@shared/domain/stableIds';
import type { UnityOrganizationIds } from '../cm/UnityOrganizationIds';
import type { SettingsStore } from './SettingsStore';
import { organizationsFollowed, organizationsToIdentify, organizationsToSearch } from './organizationsKept';

/**
 * Keeps what the app keeps for a Unity organization through a rename of the organization (`organizationsKept.ts`):
 * each time the organizations are listed, or one's settings change, it reads the recorded ids again and those of the
 * organizations that keep something unrecorded, and the others only when a recorded name no longer answers its id
 * (`UnityOrganizationIds`: local reads, once per organization until the profiles change); then it moves or records what the
 * settings keep. Settings changed meanwhile are read again before writing, so no window's change is lost.
 */
export class OrganizationRenames {
  constructor(
    private readonly settings: Pick<SettingsStore, 'get' | 'update'>,
    private readonly ids: Pick<UnityOrganizationIds, 'idOf' | 'forget'>,
  ) {}

  /** The servers the profiles list, as a listing ended the last time; null before the first. */
  private lastListed: string | null = null;

  /**
   * Follows the organizations the profiles list (`repositories.servers`). A listing that differs from the last one
   * means a sign-in (or a profile removed) since: `cm` may have learned an organization's new name and forgotten the
   * old one, so the ids are read again: the recorded ones, and the others only to find a renamed one.
   */
  async listed(servers: readonly string[]): Promise<void> {
    const listing = [...servers].map(serverKey).sort().join('\n');
    if (this.lastListed !== null && listing !== this.lastListed) this.ids.forget();
    this.lastListed = listing;
    await this.follow(servers);
  }

  async follow(servers: readonly string[]): Promise<void> {
    const kept = this.settings.get();
    const first = organizationsToIdentify(kept, servers);
    if (first.length === 0) return;
    const read = await this.idsOf(first);
    const searched = await this.idsOf(organizationsToSearch(kept, servers, read));
    const ids = new Map<string, OrganizationId>();
    for (const [server, id] of [...read, ...searched]) if (id !== undefined) ids.set(server, id);
    // Read again: a window may have changed the settings while the ids were read.
    const followed = organizationsFollowed(this.settings.get(), ids);
    if (followed) this.settings.update(followed);
  }

  /** The ids of the servers, one after another: local reads, each once for the session. */
  private async idsOf(servers: readonly string[]): Promise<Map<string, OrganizationId | undefined>> {
    const ids = new Map<string, OrganizationId | undefined>();
    for (const server of servers) ids.set(server, await this.ids.idOf(server));
    return ids;
  }
}
