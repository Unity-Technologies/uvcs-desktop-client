# Partial workspaces

A partial workspace downloads only the folders and files the user chooses; everything else stays on the server. How
the app tells a workspace's kind (`WorkspaceKind`, `workspaceKindsReader`) and shows it (`WorkspaceKindChip`) is in
ARCHITECTURE.md. This doc holds how a partial workspace is created, how the user chooses what it downloads, and how it
stays partial.

## Creating one

The Create workspace dialog offers "Download only the folders and files I choose" for a repository that exists
(`offersPartial` in `newWorkspaceForm.ts`): a new repository holds nothing to choose from. Partial and dynamic exclude
each other (`toggledKind`). The request carries the kind (`CreateWorkspaceRequest.kind`).

`workspaces.create` makes the workspace, then runs `cm partial update --silent` in it (`EMPTY_PARTIAL_UPDATE_ARGS`),
through `execute()` since it changes the workspace's files. An update of no paths downloads nothing but marks the
workspace partial, so it opens empty. Rejected alternatives:

- **A plain `cm update`** after creating it: it downloads everything and the workspace is standard.
- **`cm partial configure -/`** to mark it partial: `cm` refuses it on an empty repository.

Once it opens, the app asks what to download (`openChooseDownloads`, from `createWorkspaceAndUpdate`) instead of
updating it.

## Choosing what to download

**Choose what to download…** opens `ChooseDownloadsDialog`. It's offered on a partial workspace only:

- the current workspace card's menu (`currentWorkspaceMenu`, the `chooseDownloads` action);
- the command palette (`useWorkspaceCommands`);
- Files, whose empty state says nothing is downloaded yet while the workspace holds nothing (`showsNothingDownloaded`).

The dialog shows the repository's tree at the workspace's changeset, a folder at a time as it opens (the same listing
Browse repository reads, `repositoryListingQuery`), with a checkbox per item. A partial workspace on a branch loaded no
one changeset (`cm` reports none), so there it shows the branch's head, which its updates follow (`downloadTreePoint`);
unlike a changeset's, that listing is read again on a refresh. A workspace on a shelve has no tree to list.

What the workspace has loaded comes from one `cm ls` records read per folder (`workspaces.loadedIn`, `loadedItemsArgs`,
`readLoadedItem`), local: only the root and the open folders the workspace holds anything of (`foldersToReadLoaded`),
since `cm ls` can't list a folder that isn't loaded. A folder counts as loaded when anything below it is, as `cm`
counts it.

Its decisions are pure and tested:

- `downloadSelection.ts`: each item's checkbox (`checkStateOf`: mixed when a read folder is partly chosen), what a
  click does (`toggled`), and the fewest rules that make the workspace hold what's chosen (`downloadRules`). A folder
  downloaded or removed whole is one rule; a folder partly loaded is completed item by item, since `cm` refuses to
  load a folder that holds anything already. The root is never removed, only its items.
- `downloadTree.ts`: the rows shown (`downloadRows`), the keys (`downloadKey`, a desktop tree's), the body's state
  (`rootStatus`) and the summary beside Apply (`rulesSummary`).

An xlink is downloaded whole, like a file: its own repository's folders aren't chosen here.

## Applying

Apply runs one `cm partial configure +/<path> -/<path> … --silent` in the workspace (`partialConfigureArgs`,
`workspaces.configurePartial`, `applyDownloads`). `cm` downloads and deletes as it configures, so no update follows.
One rule `cm` refuses (a path not found, something already loaded or not) fails the whole command and nothing changes.
It runs as an update (`operations.run`, `execute()`): it blocks other updates and switches of the workspace while it
runs, and refreshes what an update refreshes.

## Staying partial

Every update the app runs on a partial workspace is `cm partial update --dontmerge` (`PARTIAL_UPDATE_ARGS`), chosen
by the workspace's kind in `updateWorkspace`: Incoming's update, the update that merges the user's resolutions
(`updateWithMerge`) and the one after shelving what blocked it (`shelveBlockedAndUpdate`). It brings what the workspace
holds up to date, new items in its folders too, and downloads nothing else. It prints no line per file, so its progress
can't be shown.
