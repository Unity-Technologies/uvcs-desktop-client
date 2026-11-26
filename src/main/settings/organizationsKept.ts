// What the app keeps for a Unity organization (its favorite, `AppSettings.favoriteOrganizations`; its settings,
// `serverSettings`) is kept by its name (`acme@unity`), as `cm` and every list name it, and follows the organization
// when its owners rename it. No other organization can ever take a name one had, so a name never leads to another
// organization's settings; but a renamed one would lose its own. So each organization that keeps something records
// its id (`ServerSettings.organizationId`), and an organization listed under a name that keeps nothing, whose id was
// recorded under its former name, takes what that name kept (ARCHITECTURE.md "Settings survive renames").

import { isFavoriteOrganization, withFavoriteOrganization } from '@shared/domain/favoriteOrganizations';
import { isUnityOrganization } from '@shared/domain/organizations';
import { serverKey } from '@shared/domain/repository';
import { serverSettingsOf, type ServerSettingsByKey } from '@shared/domain/scopedSettings';
import type { AppSettings } from '@shared/domain/settings';
import type { OrganizationId } from '@shared/domain/stableIds';

/** What the app keeps by an organization's name. */
export type OrganizationsKept = Pick<AppSettings, 'favoriteOrganizations' | 'serverSettings'>;

/**
 * The organizations listed whose id is worth reading: one that keeps something and hasn't recorded its id and, once
 * any organization recorded one, one that keeps nothing, which may be a renamed one under its new name.
 */
export function organizationsToIdentify(kept: OrganizationsKept, listed: readonly string[]): string[] {
  const anyRecorded = Object.values(kept.serverSettings).some((settings) => settings.organizationId !== undefined);
  return listed.filter((server) => isUnityOrganization(server) && serverSettingsOf(kept.serverSettings, server).organizationId === undefined && (anyRecorded || keepsSomething(kept, server)));
}

/**
 * What is kept once the organizations' ids are known, by the names they're listed under: a renamed organization takes
 * what its former name kept (what its new name keeps already wins), and one that keeps something records its id.
 * Null when nothing changes.
 */
export function organizationsFollowed(kept: OrganizationsKept, ids: ReadonlyMap<string, OrganizationId>): OrganizationsKept | null {
  let { favoriteOrganizations, serverSettings } = kept;
  let changed = false;
  for (const [server, organizationId] of ids) {
    const key = serverKey(server);
    const formerKey = Object.keys(serverSettings).find((candidate) => candidate !== key && serverSettings[candidate]!.organizationId === organizationId);
    if (formerKey !== undefined) {
      const { [formerKey]: former, ...others } = serverSettings;
      serverSettings = { ...others, [key]: { ...former, ...serverSettings[key], organizationId } };
      if (isFavoriteOrganization(favoriteOrganizations, formerKey)) {
        favoriteOrganizations = withFavoriteOrganization(withFavoriteOrganization(favoriteOrganizations, formerKey, false), server, true);
      }
      changed = true;
    } else if (serverSettings[key]?.organizationId === undefined && keepsSomething({ favoriteOrganizations, serverSettings }, server)) {
      serverSettings = { ...serverSettings, [key]: { ...serverSettings[key], organizationId } };
      changed = true;
    }
  }
  return changed ? { favoriteOrganizations, serverSettings } : null;
}

/**
 * Every server's settings, the server's id forgotten once it keeps nothing else (no favorite, no setting): recorded
 * only to follow what an organization keeps, it would otherwise outlive it, and a scope left with nothing is dropped.
 */
export function withoutIdAlone(kept: OrganizationsKept, server: string): ServerSettingsByKey {
  const key = serverKey(server);
  if (kept.serverSettings[key]?.organizationId === undefined || keepsSomething(kept, server)) return kept.serverSettings;
  const { [key]: _forgotten, ...others } = kept.serverSettings;
  return others;
}

/** Whether the organization keeps anything: a favorite or a setting, its recorded id aside. */
function keepsSomething(kept: OrganizationsKept, server: string): boolean {
  const { organizationId: _id, ...settings } = serverSettingsOf(kept.serverSettings, server);
  return isFavoriteOrganization(kept.favoriteOrganizations, server) || Object.keys(settings).length > 0;
}
