import type { BranchPin, ExplorerRule } from './branchExplorerSettings';
import { repositoryKey, serverKey } from './repository';
import type { OrganizationId, RepositoryGuid } from './stableIds';

// What the app keeps for one repository or one server, in its settings (`AppSettings.repositorySettings`,
// `serverSettings`): a repository's by its GUID, which a rename keeps (ARCHITECTURE.md "Settings survive renames"), a
// server's by `serverKey`. The main process changes one entry at a time (`SettingsStore.updateRepositorySettings`), so
// windows working in other repositories meanwhile keep theirs (ARCHITECTURE.md "Where a setting is kept").

/** What the user built up or chose in one repository. */
export interface RepositorySettings {
  /** The Branch Explorer's advanced filters and formats: their conditions name this repository's branches and people. */
  explorerRules?: ExplorerRule[];
  /** The rules are kept but apply nowhere until turned back on. */
  explorerRulesOff?: boolean;
  /** The changeset colors (`AppSettings.changesetColors`) don't apply here. */
  changesetColorsOff?: boolean;
  /** The branches the user moved to other rows in the Branch Explorer, by branch id, which only means something here. */
  branchPins?: BranchPin[];
  /** The repository this one was last synced with, a spec. */
  syncRemote?: string;
  /** The sync remote's GUID: it is found by it once its spec names no repository, or another one (`followedSpec`). */
  syncRemoteGuid?: RepositoryGuid;
}

/** What the user chose for one server (`acme@unity`, `host:8087`). */
export interface ServerSettings {
  /**
   * The project the home screen narrows this Unity organization's repositories to, by its GUID (`ProjectGuid`), which a
   * rename keeps; none for all of them. A name kept before, or by a link opened before the organization was listed,
   * moves to the GUID once a listing holds it (`movedHomeProject`).
   */
  homeProject?: string;
  /**
   * A Unity organization's id (`UnityOrganizationIds`): what its settings and favorite follow to the organization's new
   * name when its owners rename it (`OrganizationRenames`). Kept by the main process only.
   */
  organizationId?: OrganizationId;
}

/** A change to a scope's settings: a value replaces the one kept, `null` forgets it. */
export type ScopedSettingsChange<S> = { [K in keyof S]?: S[K] | null };

/**
 * Every repository's settings, under its GUID; those kept before by its spec, under its `repositoryKey`, until its GUID
 * is known (`withRepositoryKeptByGuid`).
 */
export type RepositorySettingsByKey = Readonly<Record<string, RepositorySettings>>;

/** Every server's settings, a server's under its `serverKey`. */
export type ServerSettingsByKey = Readonly<Record<string, ServerSettings>>;

const NO_SETTINGS = {};

/** The repository's settings; the same empty object for one with none, or whose GUID isn't known. */
export function repositorySettingsOf(byRepository: RepositorySettingsByKey, repository: RepositoryGuid | undefined): RepositorySettings {
  return (repository === undefined ? undefined : byRepository[repository]) ?? NO_SETTINGS;
}

/** The server's settings, however it is written; the same empty object for one with none. */
export function serverSettingsOf(byServer: ServerSettingsByKey, server: string | undefined): ServerSettings {
  return (server === undefined ? undefined : byServer[serverKey(server)]) ?? NO_SETTINGS;
}

/** Every repository's settings with the changes made to `repository`'s. */
export function withRepositorySettings(
  byRepository: RepositorySettingsByKey,
  repository: RepositoryGuid,
  changes: ScopedSettingsChange<RepositorySettings>,
): Record<string, RepositorySettings> {
  return withScopeChanged(byRepository, repository, changes);
}

/**
 * Every repository's settings with what was kept by `spec` before (`repositoryKey`) moved under the repository's
 * GUID, where the GUID's own win; the same object when nothing was kept by the spec.
 */
export function withRepositoryKeptByGuid(byRepository: Record<string, RepositorySettings>, spec: string, guid: RepositoryGuid): Record<string, RepositorySettings> {
  const { [repositoryKey(spec)]: byName, ...others } = byRepository;
  if (!byName) return byRepository;
  return { ...others, [guid]: { ...byName, ...byRepository[guid] } };
}

/** Every server's settings with the changes made to `server`'s. */
export function withServerSettings(byServer: ServerSettingsByKey, server: string, changes: ScopedSettingsChange<ServerSettings>): Record<string, ServerSettings> {
  return withScopeChanged(byServer, serverKey(server), changes);
}

/**
 * Every repository's settings with what another place kept for them by their spec (a window's storage, before these
 * settings held them) added where they keep nothing of their own yet: what is already here wins, so adding the same
 * twice changes nothing. They stay under the spec's `repositoryKey` until the repository's GUID is known
 * (`withRepositoryKeptByGuid`).
 */
export function withRepositorySettingsAdded(byRepository: RepositorySettingsByKey, added: Readonly<Record<string, RepositorySettings>>): Record<string, RepositorySettings> {
  return withScopesAdded(byRepository, added, repositoryKey);
}

/** Every server's settings with another place's added, as `withRepositorySettingsAdded` adds a repository's. */
export function withServerSettingsAdded(byServer: ServerSettingsByKey, added: Readonly<Record<string, ServerSettings>>): Record<string, ServerSettings> {
  return withScopesAdded(byServer, added, serverKey);
}

/**
 * The scope's settings changed, keeping only what differs from having nothing: a forgotten value, `false`, an empty
 * text or list leave no trace, and a scope left with nothing is dropped, so the file holds only what the user set.
 */
function withScopeChanged<S extends object>(byKey: Readonly<Record<string, S>>, key: string, changes: ScopedSettingsChange<S>): Record<string, S> {
  const { [key]: current, ...others } = byKey;
  const changed = withoutDefaults({ ...current, ...changes });
  return Object.keys(changed).length === 0 ? others : { ...others, [key]: changed as S };
}

function withScopesAdded<S extends object>(byKey: Readonly<Record<string, S>>, added: Readonly<Record<string, S>>, keyOf: (scope: string) => string): Record<string, S> {
  const result: Record<string, S> = { ...byKey };
  for (const [scope, settings] of Object.entries(added)) {
    const key = keyOf(scope);
    const merged = withoutDefaults({ ...settings, ...result[key] });
    if (Object.keys(merged).length > 0) result[key] = merged as S;
  }
  return result;
}

function withoutDefaults(settings: object): object {
  return Object.fromEntries(Object.entries(settings).filter(([, value]) => !isDefault(value)));
}

function isDefault(value: unknown): boolean {
  return value === null || value === undefined || value === false || value === '' || (Array.isArray(value) && value.length === 0);
}
