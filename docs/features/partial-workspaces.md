# Partial workspaces

A partial workspace downloads only the folders and files the user chooses; everything else stays on the server. How
the app tells a workspace's kind (`WorkspaceKind`, `workspaceKindsReader`) and shows it (`WorkspaceKindChip`) is in
ARCHITECTURE.md. This doc holds how a partial workspace is created, how the user chooses what it downloads, and how it
stays partial.

## Creating one

The Create workspace dialog asks "What to download": **The whole branch** (standard, the default) or **Only the folders
I pick** (partial). Each card says when to choose it (`downloadCards` in `newWorkspaceForm.ts`), since the app has one
window for both kinds where the official client had a separate app for partial workspaces: the whole branch switches
and merges freely; picked folders download less and update file by file, but `cm` refuses to merge into a partial
workspace and switches it only to branches. The cards show from the start, before a repository is named; picking
folders is greyed for a new repository, which holds nothing to pick (`partialAllowed`). The kind chosen stays partial
meanwhile (`kindChosen`): the dialog shows the whole branch, and naming an existing repository brings the folders back
without the user picking them again. Choosing a card sets the kind
(`kindForDownloads`); picking folders greys the dynamic checkbox (`dynamicDisabled`, ticked with `toggledKind`), since
a dynamic workspace has the whole branch. The request carries the kind
(`CreateWorkspaceRequest.kind`).

The cards don't say the choice can change later: the app doesn't convert a workspace between partial and standard.
Only which folders a partial workspace holds changes later.

`workspaces.create` makes the workspace, then runs `cm partial update --silent` in it (`EMPTY_PARTIAL_UPDATE_ARGS`),
through `execute()` since it changes the workspace's files. An update of no paths downloads nothing but marks the
workspace partial, so it opens empty. If that update fails, the workspace is deleted (`markPartial`, `discardNew`), and
its folder if `create` made it: left behind, it would be a standard workspace with nothing downloaded whose name and
folder stop the user creating it again. Rejected alternatives:

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
- `downloadTreeReads.ts`: what the folder reads give the tree (`downloadTreeReads`: the listings, what's loaded, the
  folders that failed to read) and when Apply can run (`canApply`).

An xlink is downloaded whole, like a file: its own repository's folders aren't chosen here.

Items draw as Files draws them (`ItemIcon`, `iconTypeOf`). A search above the tree finds a file or folder anywhere in
it, as Files' Go to file does (`useRepositoryFileSearch` with `'onSearch'`, `repositoryFileSearchView`): it lists the
whole tree only once the user types, since most choose by opening folders and that listing is the server's heaviest
read. It searches what the tree shows, and its notes name it so (`downloadSearchOf`): the tree's changeset or, on a
branch, the branch's head, named by the branch. A pick opens the folders above it and selects it in the tree (`revealedDownload`). A workspace on a shelve has no search, as it has no tree.

## Applying

Apply runs one `cm partial configure +/<path> -/<path> … --silent` in the workspace (`partialConfigureArgs`,
`workspaces.configurePartial`, `applyDownloads`). `cm` downloads and deletes as it configures, so no update follows.
One rule `cm` refuses (a path not found, something already loaded or not) fails the whole command and nothing changes.
It runs as an update (`operations.run`, `execute()`): it blocks other updates and switches of the workspace while it
runs, and refreshes what an update refreshes. Every `cm partial` command is a write of the workspace
(`changesWorkspace`), so it runs in a `cm shell` of its own that reads it from its input (`processCommand`): a choice of
thousands of items is still one command, past the command-line limit, rather than several that could stop halfway.

## Staying partial

Every update the app runs on a partial workspace is `cm partial update --dontmerge` (`PARTIAL_UPDATE_ARGS`), chosen
by the workspace's kind in `updateWorkspace`: Incoming's update, the update that merges the user's resolutions
(`updateWithMerge`) and the one after shelving what blocked it (`shelveBlockedAndUpdate`). It brings what the workspace
holds up to date, new items in its folders too, and downloads nothing else. It prints no line per file, so its progress
can't be shown.
