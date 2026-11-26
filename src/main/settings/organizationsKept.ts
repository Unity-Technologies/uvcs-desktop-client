// What the app keeps for a Unity organization (its favorite, `AppSettings.favoriteOrganizations`; its settings,
// `serverSettings`) is kept by its name (`acme@unity`), as `cm` and every list name it, and follows the organization
// when its owners rename it. No other organization can ever take a name one had, so a name never leads to another
// organization's settings; but a renamed one would lose its own. So each organization that keeps something records
// its id (`ServerSettings.organizationId`). Each session reads those ids again by their names; only when a name no
// longer answers its id are the other organizations listed read, and the one with that id takes what its former name
// kept (ARCHITECTURE.md "Settings survive renames").

import { isFavoriteOrganization, withFavoriteOrganization } from '@shared/domain/favoriteOrganizations';
import { isUnityOrganization } from '@shared/domain/organizations';
import { serverKey } from '@shared/domain/repository';
import { serverSettingsOf, type ServerSettingsByKey } from '@shared/domain/scopedSettings';
import type { AppSettings } from '@shared/domain/settings';
import type { OrganizationId } from '@shared/domain/stableIds';

/** What the app keeps by an organization's name. */
export type OrganizationsKept = Pick<AppSettings, 'favoriteOrganizations' | 'serverSettings'>;

/**
 * The organizations whose id is worth reading first: each that recorded one, to confirm its name still answers it,
 * and each listed that keeps something with no id recorded yet. Once per session each (`UnityOrganizationIds`).
 */
export function organizationsToIdentify(kept: OrganizationsKept, listed: readonly string[]): string[] {
  const recorded = Object.keys(kept.serverSettings).filter((key) => kept.serverSettings[key]!.organizationId !== undefined);
  return [...recorded, ...unrecorded(kept, listed).filter((server) => keepsSomething(kept, server))];
}

/**
 * The organizations to read next, to find a renamed one: when a name that recorded an id no longer answers it (`cm`
 * learned the organization's new name, and forgot the old one), every listed organization not read yet with no id
 * recorded, one of which is it under its new name. None while every recorded name answers its id.
 */
export function organizationsToSearch(kept: OrganizationsKept, listed: readonly string[], read: ReadonlyMap<string, OrganizationId | undefined>): string[] {
  const readByKey = new Map([...read].map(([server, id]) => [serverKey(server), id]));
  const lost = Object.entries(kept.serverSettings).some(([key, { organizationId }]) => organizationId !== undefined && readByKey.has(key) && readByKey.get(key) !== organizationId);
  return lost ? unrecorded(kept, listed).filter((server) => !readByKey.has(serverKey(server))) : [];
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

/** The listed Unity organizations with no id recorded. */
function unrecorded(kept: OrganizationsKept, listed: readonly string[]): string[] {
  return listed.filter((server) => isUnityOrganization(server) && serverSettingsOf(kept.serverSettings, server).organizationId === undefined);
}

/** Whether the organization keeps anything: a favorite or a setting, its recorded id aside. */
function keepsSomething(kept: OrganizationsKept, server: string): boolean {
  const { organizationId: _id, ...settings } = serverSettingsOf(kept.serverSettings, server);
  return isFavoriteOrganization(kept.favoriteOrganizations, server) || Object.keys(settings).length > 0;
}
