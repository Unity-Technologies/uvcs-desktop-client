# Exploring a repository without a workspace

A repository can be looked at without downloading it: its files, Branch Explorer, changesets, branches, labels, shelves,
attributes, code reviews and locks, their diffs and histories, in a window of its own, with nothing on disk. Liking what
it shows, the user makes it a workspace from there, without leaving it. How the server's commands name the repository
when no workspace tells `cm` which: ARCHITECTURE.md "Places".

## Where it starts

- **The home screen**: a repository's row offers Explore beside New workspace when no workspace is on it, and its menu
  offers Explore and Explore in new window always (`repositoryMenu`). Shift on the row's Explore opens it in a new
  window, as Shift does for a workspace (`windowAskedBy`).
- **A link to a repository with no workspace on it** explores it, nothing asked (`exploreFor`, docs/features/deep-links.md
  "Opening a link"): the window exploring it takes the link, else this one on the home screen, else a new one.
- **A window reopened at launch** explores what it explored when the app quit (`SavedWindow.repository`).

Exploring here (`exploreHere`) brings forward the window already exploring the repository instead: one window per
place. A workspace on the same repository is another place, with its own window.

## What its window shows

The views of the server, each at its usual place in the sidebar and its usual shortcut (`showsView`, `viewsOf`):
Files, Branch Explorer, Changesets, Branches, Labels, Shelves, Attributes, Code reviews, Locks; the sidebar groups
Files as the Repository (`sidebarGroups`). It opens on the Branch Explorer (`firstViewOf`). Not a workspace's own: Changes, Incoming
and Sync. A view a repository doesn't show, named by a link or by a window reopened after an update, opens the first
view instead.

## Files

A branch's latest tree, read-only, as a code host shows a repository (`RepositoryFilesView`): the main branch's until
another is picked in the filter bar's branch chip (`FilesBranchPicker`, the branch switcher's list, read only once it
opens). Files reads the branch shown alone, never every branch (`filesBranchToRead`: `branches.get`), and shows what
`repositoryFilesBodyOf` says: the branch's latest tree; the main branch again once the one picked is gone, renamed, or
another branch took its name (kept by name and GUID, `ChosenBranch`); a branch to pick where the main branch was
renamed. The header says which: "Latest of /main · changeset 12" (`filesBranchCaption`).

The tree is Browse repository's (`RepositoryTree`): a folder is listed as it opens, each once per changeset; a file
shows its last change, its history and annotations; its menus are Browse repository's (`revisionMenu`: a revision
opens in an app or is saved as a copy; nothing is on disk to move, cut or paste). Another branch opens its tree on the
item selected before, when it has it. The folders open are the branch's (its tree id is the branch's GUID), so a new
head on refresh shows the latest tree with them still open. The branch picked is kept per repository while the window
lives (`useRepositoryFilesStore`). An item and its lines link as the workspace's Files do (`branchFilesOrigin`,
`useFilesItemLinks`), and a link to a path (`/path/…`) opens Files on it (`requestReveal`, by place).

Create workspace makes a workspace on the main branch, as the New workspace dialog does, whatever branch Files shows:
its Files then shows the workspace's disk. Switching it to the branch is the workspace's own branch switch.

## Finding a file

Go to file (⌘P, `/` in the tree, the palette's "Go to file…", the search button in Files' header) finds a file or folder of the
branch Files shows by name, as a workspace's does (`goToRepositoryFile`), from the first character (`searchesFor`: any query costs one read of the tree's file). `cm`
filters no tree by name, so the first search of a changeset lists its whole tree, once (`RepositoryPathSearch`):

- **One `cm ls / -R --tree=cs:<head>@<repository> --format={type}␟{path}␞`** (`repositoryPathsArgs`), in a process of
  its own (`executeRecords`): cancellable, and it never holds a pooled shell for its seconds. Its records are read as
  they arrive, each written to a file of the session's (`SessionFolder`, `uvcs-trees-<pid>-…`) and offered to the
  searches waiting, and nothing is kept: a search keeps its best 60 alone (`BestPaths`, ranked as the renderer's lists
  rank, `shared/fuzzyScore`). The searches asked meanwhile join it (`repositoryPathsFound` tells each the best so far);
  the dialog says it reads the files from the server meanwhile (`repositoryFileSearchView`).
- **Every later search of that changeset reads the file**, never the server: on a large repository (79,000 items, 6.7 MB) about
  120 ms. The file is written as `.partial` and renamed once whole, so a listing that failed or stopped leaves none.
- **A repository keeps the 3 trees searched last** (`TREES_KEPT`): a window or two going back and forth between
  branches never lists one again. Its last window leaving it deletes its trees (`forget`, from `onRepositoryLeft`), the
  app quitting deletes them all (`dispose`), and the folder a crashed session left is deleted as the next one starts
  (`removeLeftOvers`). A tree whose file went (the OS clearing its temp folder) is listed again.
- A newer query stops the search before it (`stopFindingRepositoryPaths`), at once; the listing goes on for the next.
  Each search is told apart by an id unique across windows, and its results go to the window that asked, even when it
  joined a listing another window started.
- Paths read as the tree names them: forward slashes on every OS (Windows' `cm` prints `/Assets\Player.cs`), and an
  xlink as a folder.

`cm` sends the tree only once it has built it, so the first results come with the whole listing: on that repository about 10 s,
5 of them `cm ls` resolving each item's owner one by one, even with a format that prints no owner.

## What it offers, and what it doesn't

Everything that reads or changes the server's objects works as in a workspace, through the same code
(ARCHITECTURE.md "Places"): diffs, histories, annotate, Browse repository, Copy and its links, creating, renaming and
deleting branches and labels, comments, attributes, permissions, code reviews, deleting shelves. A new branch starts
from the branch selected (`newBranchButton`); a new label from a changeset picked (`newLabel`).

What needs the disk is never offered: the words listed in `NEEDS_A_WORKSPACE` (switching, merging into a workspace,
cherry picking, applying a shelve, reverting, checking in, opening a file in an app), the workspace commands of the
menu bar (`REPOSITORY_MENU_COMMANDS`: only the command log), editing or discarding in a diff (`editedFileIn`,
`discardedFileIn`), releasing a lock (`unlocksIn`), switching to a new label (`offersSwitchToNewLabel`). Server merges
(Merge to…, finishing a task) and a 3D model's Unity materials need a workspace for now. `M` in the Branch Explorer merges
nothing (`keyboardMergeSource`), and a merge page reached anyway says it needs a workspace instead of opening
(`showsPage`, in `PageFrame`).

A server out of reach, or wanting a sign-in, shows in the corner card as a workspace's does, the repository's server
read from its spec (`serverOfPlace`); Settings ▸ Accounts lists its account first.

## Create workspace

The top bar's Create workspace (and the palette's "Create workspace…", `useRepositoryCommands`) opens the New
workspace dialog with the repository fixed (`createWorkspaceOfExplored`). Created, the window opens it on the view and
pages it shows (every view of a repository is a workspace's too), each view's rows still selected
(`carryViewSelections`), while its files download (`createWorkspaceAndUpdate`), and remembers it as recent: the exploration goes on as the workspace's, nothing left. The main process hears the
window shows a workspace now and stops counting it as exploring (`WorkspaceWindows.workspaceShown`).

## Tried and dropped

- A temporary workspace for each repository explored, the official client's way: ARCHITECTURE.md "Places".
- Asking `cm` to filter a tree by name, for Go to file: it can't. `cm find revision` takes an `item` but no pattern
  ("Integer operator like is not currently supported for item"), and there is no `cm find item`; hence one whole
  listing per changeset ("Finding a file").
- Keeping a repository's whole tree in memory to search it, as a workspace's Go to file keeps its paths: tens of MB of
  strings for a big repository, held for every changeset searched. The file costs the same once, on disk.
