import type { RepositorySettings, ServerSettings } from './scopedSettings';
import type { AppSettings } from './settings';

// What each setting keeps the objects it names by (ARCHITECTURE.md "Settings survive renames"). A name changes with a
// rename, and what was kept by it is lost: a repository, branch or project is kept by its GUID (`stableIds.ts`), a
// workspace by its GUID. A path or a name is kept only where nothing stable exists, and says why.
//
// Every setting has its line here, and the type checker asks for one when a setting is added: whoever adds it decides
// what it is kept by.

/** What a setting keeps the objects it names by. */
export type SettingIdentity =
  /** It names no workspace, repository, branch, project, organization or user: a choice of the app. */
  | 'namesNoObject'
  | 'workspaceGuid'
  | 'repositoryGuid'
  | 'branchGuid'
  | 'projectGuid'
  /**
   * A Unity organization, by its name (`acme@unity`), as `cm` and every list name it: its owners can rename it, and no
   * other organization ever takes a name one had, so what it keeps follows it to its new name by its id
   * (`OrganizationRenames`). Which one names a server of its own too says how that one is kept.
   */
  | { organizationFollowedById: string }
  /** An object kept by its number in the repository whose settings hold it: numbers are per repository, as these are. */
  | { byIdIn: 'repository'; because: string }
  /** A file or folder, found by its path: why no GUID does. */
  | { byPath: string }
  /** `cm` prints no stable id for it: why its name is all there is. */
  | { byName: string };

export const APP_SETTINGS_IDENTITY: { readonly [Setting in keyof AppSettings]: SettingIdentity } = {
  theme: 'namesNoObject',
  recentWorkspacePaths: { byPath: 'Opening a workspace takes its folder; a workspace moved is found again by opening it.' },
  recentBranchesByWorkspace: 'workspaceGuid',
  pendingChanges: 'namesNoObject',
  warnOnEmptyComment: 'namesNoObject',
  recentComments: 'namesNoObject',
  recentCommentsByRepository: { byName: 'Not yet: kept by the repository’s spec.' },
  autoRefresh: 'namesNoObject',
  cmChoice: 'namesNoObject',
  cmDeclinedUpdateFor: 'namesNoObject',
  defaultWorkspaceRoot: 'namesNoObject',
  pendingChangesOnSwitch: 'namesNoObject',
  restoreLeftChangesAutomatically: 'namesNoObject',
  switchShelves: { byName: 'Not yet: by workspace GUID, but matched to the workspace’s repository and branch by name.' },
  reviewModeWorkspaces: { byPath: 'Not yet: a workspace by its path, a repository by its spec.' },
  reviewModeHintDone: 'namesNoObject',
  showGravatar: 'namesNoObject',
  gravatarChoiceAsked: 'namesNoObject',
  notifyOnIncoming: 'namesNoObject',
  homeAccount: { byName: 'A Unity account is the user cm signs in with, a server account its server: cm has no other id for either.' },
  favoriteOrganizations: { organizationFollowedById: 'A cloud organization (`acme@cloud`), which cm gives no id, by its name alone.' },
  repositorySettings: { byName: 'Not yet: kept by the repository’s spec.' },
  serverSettings: { organizationFollowedById: 'A cloud organization by its name alone, as cm gives it no id; a server of its own by its address, which has no other id.' },
  changesetColors: { byName: 'cm prints no id for a user, only the owner of what they made.' },
  mergeTool: 'namesNoObject',
  mergeToolRules: 'namesNoObject',
  customMergeTools: 'namesNoObject',
  mergeToolArgs: 'namesNoObject',
  askWhenMergeToolClosesUnsaved: 'namesNoObject',
  editor: 'namesNoObject',
  terminal: 'namesNoObject',
  customEditors: 'namesNoObject',
  tools: 'namesNoObject',
  zoomLevel: 'namesNoObject',
  windowBounds: 'namesNoObject',
  pageWindowBounds: 'namesNoObject',
  openWindows: { byPath: 'Not yet: a workspace by its folder, which reopening it takes; a repository explored without one by its spec.' },
  legacySettingsImported: 'namesNoObject',
  legacyMergeToolsImported: 'namesNoObject',
  legacyToolsImported: 'namesNoObject',
};

export const REPOSITORY_SETTINGS_IDENTITY: { readonly [Setting in keyof Required<RepositorySettings>]: SettingIdentity } = {
  explorerRules: { byName: 'Each rule is a cm find condition the user writes, like a search kept: it names what the user typed.' },
  explorerRulesOff: 'namesNoObject',
  changesetColorsOff: 'namesNoObject',
  branchPins: { byIdIn: 'repository', because: 'The Branch Explorer draws branches by their number, which a rename keeps.' },
  syncRemote: { byName: 'Not yet: the remote repository by its spec.' },
};

export const SERVER_SETTINGS_IDENTITY: { readonly [Setting in keyof Required<ServerSettings>]: SettingIdentity } = {
  homeProject: 'projectGuid',
  organizationId: { organizationFollowedById: 'The id itself, of the organization whose settings hold it.' },
};
