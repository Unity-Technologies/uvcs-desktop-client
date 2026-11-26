import type { OrganizationId } from '@shared/domain/stableIds';
import type { SettingsStore } from './SettingsStore';
import { organizationsFollowed, organizationsToIdentify } from './organizationsKept';

/**
 * Keeps what the app keeps for a Unity organization through a rename of the organization (`organizationsKept.ts`):
 * each time the organizations are listed, or one's settings change, it reads the ids worth reading
 * (`UnityOrganizationIds`: local reads, once per organization for the session) and moves or records what the settings
 * keep. Settings changed meanwhile are read again before writing, so no window's change is lost.
 */
export class OrganizationRenames {
  constructor(
    private readonly settings: Pick<SettingsStore, 'get' | 'update'>,
    private readonly ids: { idOf(server: string): Promise<OrganizationId | undefined> },
  ) {}

  async follow(servers: readonly string[]): Promise<void> {
    const wanted = organizationsToIdentify(this.settings.get(), servers);
    if (wanted.length === 0) return;
    const ids = new Map<string, OrganizationId>();
    for (const server of wanted) {
      const id = await this.ids.idOf(server);
      if (id !== undefined) ids.set(server, id);
    }
    const followed = organizationsFollowed(this.settings.get(), ids);
    if (followed) this.settings.update(followed);
  }
}
