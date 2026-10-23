# Exploring a repository without a workspace

A repository can be looked at without downloading it: its Branch Explorer, changesets, branches, labels, shelves,
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

The views of the server, each at its usual place in the sidebar and its usual shortcut (`showsView`, `viewsOf`), the
Branch Explorer first (`firstViewOf`): Branch Explorer, Changesets, Branches, Labels, Shelves, Attributes, Code
reviews, Locks. Not a workspace's own: Changes, Incoming, Files (its files on disk) and Sync. A view a repository
doesn't show, named by a link or by a window reopened after an update, opens the first view instead.

- **The top bar**: the search (`TopBarSearch`), **Create workspace**, the account on the repository's server.
- **The sidebar's card** names the repository and its server as the home screen does (`RepositorySidebarCard`), and
  opens the workspace switcher, which leads elsewhere only: nothing of a workspace's own to act on.
- **The status bar** has the command log and the version: nothing runs on the repository, and it is on no branch.
- **The command log's own scope** is "This repository": the commands run outside every workspace
  (`CommandLogEntry.outsideWorkspaces`, `ranInPlace`).
- **The window is titled** "<repository> — <server>" (`repositoryWindowTitle`).
- **The palette** searches its branches, labels, changesets, shelves and code reviews; no files or pending changes
  (`paletteGroups`).

## What it offers, and what it doesn't

Everything that reads or changes the server's objects works as in a workspace, through the same code
(ARCHITECTURE.md "Places"): diffs, histories, annotate, Browse repository, Copy and its links, creating, renaming and
deleting branches and labels, comments, attributes, permissions, code reviews, deleting shelves. A new branch starts
from the branch selected (`newBranchStart`); a new label from a changeset picked (`newLabel`).

What needs the disk is never offered: the words listed in `NEEDS_A_WORKSPACE` (switching, merging into a workspace,
cherry picking, applying a shelve, reverting, checking in, opening a file in an app), the workspace commands of the
menu bar (`REPOSITORY_MENU_COMMANDS`: only the command log), editing or discarding in a diff (`editedFileIn`,
`discardedFileIn`), releasing a lock (`unlocksIn`), switching to a new label (`offersSwitchToNewLabel`). Server merges
(Merge to…, finishing a task) and a 3D model's Unity materials need a workspace for now.

## Create workspace

The top bar's Create workspace (and the palette's "Create workspace…", `useRepositoryCommands`) opens the New
workspace dialog with the repository fixed (`createWorkspaceOfExplored`). Created, the window opens it on the view and
pages it shows (every view of a repository is a workspace's too) while its files download (`createWorkspaceAndUpdate`),
and remembers it as recent: the exploration goes on as the workspace's, nothing left. The main process hears the
window shows a workspace now and stops counting it as exploring (`WorkspaceWindows.workspaceShown`).

## Tried and dropped

A temporary workspace for each repository explored, the official client's way: ARCHITECTURE.md "Places".
