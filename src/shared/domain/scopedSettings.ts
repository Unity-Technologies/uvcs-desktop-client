import type { BranchPin, ExplorerRule } from './branchExplorerSettings';
import { repositoryKey, serverKey } from './repository';

// What the app keeps for one repository or one server, in its settings (`AppSettings.repositorySettings`,
// `serverSettings`), by `repositoryKey` and `serverKey`. The main process changes one entry at a time
// (`SettingsStore.updateRepositorySettings`), so windows working in other repositories meanwhile keep theirs
// (ARCHITECTURE.md "Where a setting is kept").

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
}

/** What the user chose for one server (`acme@unity`, `host:8087`). */
export interface ServerSettings {
  /** The project the home screen narrows this Unity organization's repositories to; none for all of them. */
  homeProject?: string;
}

/** A change to a scope's settings: a value replaces the one kept, `null` forgets it. */
export type ScopedSettingsChange<S> = { [K in keyof S]?: S[K] | null };

/** Every repository's settings, a spec's under its `repositoryKey`. */
export type RepositorySettingsByKey = Readonly<Record<string, RepositorySettings>>;

/** Every server's settings, a server's under its `serverKey`. */
export type ServerSettingsByKey = Readonly<Record<string, ServerSettings>>;

const NO_SETTINGS = {};

/** The repository's settings, however its spec is written; the same empty object for one with none. */
export function repositorySettingsOf(byRepository: RepositorySettingsByKey, repository: string | undefined): RepositorySettings {
  return (repository === undefined ? undefined : byRepository[repositoryKey(repository)]) ?? NO_SETTINGS;
}

/** The server's settings, however it is written; the same empty object for one with none. */
export function serverSettingsOf(byServer: ServerSettingsByKey, server: string | undefined): ServerSettings {
  return (server === undefined ? undefined : byServer[serverKey(server)]) ?? NO_SETTINGS;
}

/** Every repository's settings with the changes made to `repository`'s. */
export function withRepositorySettings(
  byRepository: RepositorySettingsByKey,
  repository: string,
  changes: ScopedSettingsChange<RepositorySettings>,
): Record<string, RepositorySettings> {
  return withScopeChanged(byRepository, repositoryKey(repository), changes);
}

/** Every server's settings with the changes made to `server`'s. */
export function withServerSettings(byServer: ServerSettingsByKey, server: string, changes: ScopedSettingsChange<ServerSettings>): Record<string, ServerSettings> {
  return withScopeChanged(byServer, serverKey(server), changes);
}

/**
 * Every repository's settings with what another place kept for them (a window's storage, before these settings held
 * them) added where they keep nothing of their own yet: what is already here wins, so adding the same twice changes
 * nothing.
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
