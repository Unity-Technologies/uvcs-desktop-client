# Xlinks

An xlink is a folder of the workspace that shows another repository at a changeset. How the app reads items under
one (revision ids per repository, `RevisionRef`, `cm ls --tree` through xlinks) is in ARCHITECTURE.md ("Xlinks").
This doc holds how xlinks are created and edited.

## Creating and editing

Files offers **New xlink…** on a controlled folder or file of the workspace's repository (it goes in the folder, or
the file's folder: `newXlinkDirectoryOf`) and **Edit xlink…** on an xlink (`editableXlinkOf`). Neither shows on an
xlink nested in another, nor New xlink… on an xlink or anything under one: it would go in the xlinked repository.
What is under an xlink is read from the tree's listings of the folders above the item (`isUnderXlink`) and from the
item's repository (`XlinkSurroundings`), with no `cm` command. Both open `XlinkDialog`, whose fields, checks and what
it saves are decided by `xlinkDraft.ts` (`xlinkDialogFields`, `newXlinkOf`, `xlinkEditOf`).

- **Where it points**: a branch (its latest changeset; the default, `/main`), a changeset or a label of the
  repository picked (`RepositoryPicker`). An xlink always stores a changeset: `cm` turns a branch or a label into the
  changeset it is on as the xlink is saved, and the xlink stays there until it is edited again.
- **Writable** (`-w`): changes made under it are checked in to its repository. A read-only xlink may show a folder of
  its repository instead of all of it; a writable one can't (`cm`: "Only xlinks to root (/) are currently supported
  for writable Xlinks"), so the dialog offers the folder only while read-only. The folder is typed or chosen from the
  repository's tree where the xlink points (`pickRepositoryFolder`, its rows and keys in `repositoryFolderTree.ts`),
  read a folder at a time as it opens: one `cm ls <folder> --tree=<spec>` each (`XlinksApi.folders`). `cm ls` takes a
  changeset or a branch of another repository but refuses a label, so a label's tree is read at its changeset, which
  one `cm find label ... on repository` names first (`XlinksApi.treePoint`). Nested xlinks are left out: an xlink
  can't show a folder of one.
- **Typed, or chosen from a list**: every field naming an object has a "Choose" button beside it (`PickField`), as
  the legacy client offers its explorer dialogs there; the repository and server are chosen from lists already
  (`RepositoryPicker`). What it points to opens the app's branch, changeset or label picker (`pickBranch`,
  `pickChangeset`, `pickLabel`) on the xlinked repository; a rule's first branch the workspace's branches, its second
  the xlinked repository's (`PickSource`: `pointSource`, `workspaceBranches`, `xlinkedBranches`). The xlinked
  repository is a place of its own (`repositoryPlace`, ARCHITECTURE.md "Places"): the pickers list it as a window
  exploring it would, one `cm find ... on repository '<repo>'` each, keyed apart from the workspace's lists
  (`queryKeys.inPlace`), and only once a new xlink has its repository. So a list of it never stands for the
  workspace's: its changesets and branches have other ids and GUIDs.
- **Relative server** (`-rs`): the repository is looked up on the server the workspace's repository is on, for
  repositories replicated to several servers. It stays relative when `cm xlink -e` names a server.
- **Branch expansion rules**, a writable xlink's only (`cm` refuses them on a read-only one): a change made under the
  xlink while on a branch of the workspace's repository (`from`) is checked in on a branch of the xlinked repository
  (`to`). Without a rule, `cm` picks or creates the branch itself and adds a rule for it, which `cm xlink --show`
  prints without its `[user-defined]` mark; the dialog notes those (`RuleRow.automatic`) and treats one the user
  edits as theirs. One rule per `from` branch: `cm` refuses a second, so a changed rule is deleted, then added.
- **Only where it points and its rules change.** `cm xlink -e` changes the point and keeps writable, folder and
  server; nothing changes those or the repository, so the edit dialog shows them in its description only. Moving or
  renaming the folder is Rename, Cut and Paste, as for any item.

Editing an xlink checks it out; editing one not checked in yet leaves it added (the dialog says which:
`descriptionOfEdited`). The change reaches others once checked in.

## Creating checks it in and loads its files

`cm` fills an xlink's folder only from the server's tree: a pending xlink has no files, and no `cm` command loads
them. So **Create and check in** (`XlinksApi.create`) creates the xlink, checks it in alone with the dialog's comment
(`checkinCommentOf`: the one typed, or "Add xlink <path>"), and loads its files, one operation. Other pending changes
stay pending. Updating the workspace wouldn't load them: it is at the changeset the checkin made, so `cm update`
finds it up to date and reads no tree; updating the xlink's folder does (`loadXlinkArgs`).

Before updating a folder, `cm` looks for pending changes in the whole workspace and does as client.conf's
`PendingChangesOnSwitchAction` says. Unset, as by default, it updates the folder and leaves them as they are. Set to
shelve them, it would shelve, undo and merge them back itself, which the app never lets `cm` do (as
`switchWithChanges`); `--machinereadable` turns that into refusing, as a setting to fail does. On a refusal
(`loadXlink`), unchanged checkouts are undone, a merge in progress is left alone (the files don't load), and other
changes are put aside as a switch puts them: an automatic shelve recorded with `reason: 'xlink'`, undo, added files
moved aside, the folder updated, the shelve merged back. The workspace didn't move, so only a change under the new
folder could conflict; changes that don't come back cleanly wait in their shelve, offered by "Welcome back" as "put
aside to load an xlink". A failure before the files load puts the changes back. The refusal's words are localized,
so it is told apart only by changes being pending: any failed update with changes pending takes this path. When `cm`
fails before the changes are shelved (the server is down), nothing changed and the error is what `cm update` said;
the app's own reasons they can't be shelved (changes inside another xlink: "Check them in first") stay as they are.

The files load with no progress bar, "Loading its files" alone: `--forcedetailedprogress`, which prints the bar
`readUpdateProgress` reads, is turned off by `--machinereadable`, which keeps `cm` from shelving.

Once `cm xlink` made it, the xlink exists whatever comes next: a later step that fails ends the operation with what
it is now (`CreatedXlink`: not checked in, a pending change to check in from Changes; or checked in without its
files) rather than an error, so the dialog closes instead of offering to create it again (`createdXlinkMessage`).
Only `cm xlink` failing keeps the dialog open.

**Load its files** (`XlinksApi.load`, `loadXlinkFiles`) loads them later, the same way: on a checked-in xlink whose
folder Files listed empty (`unloadedXlinkOf`), as one checked in from Changes is, and from the toast when they didn't
load as it was created. An added xlink isn't offered it: nothing loads one before it's checked in.

An edit that fails halfway leaves the xlink as the dialog still shows it, so Save can be pressed again: when adding
the new rules fails, the rules just deleted are added back (`xlinksService`). Pointing it again where the first try
already did changes nothing.

## `cm` commands

All in `main/cm/xlinkArgs.ts` (arguments) and `xlinkShow.ts` (`parseXlinkRules`), run by `xlinksService`. No
`cm xlink` moves files, so each is a quick `query()`; each creates or edits an item, so it counts as the app's own
write (`changesWorkspace`), except `--show`. Creating also checks in and updates, both processes (`execute()`).

| Does                     | Command                                                                  | When                                        |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------- |
| Reads the rules          | `cm xlink --show <path>`                                                 | Edit xlink… on a writable xlink, once       |
| Creates                  | `cm xlink [-w] [-rs] <path> <folder> <point spec> [rules]`               | Create and check in                         |
| Checks the new one in    | `cm checkin <path> --all --dependencies -commentsfile=<file>` (`checkinArgs`) | Create and check in, once created      |
| Loads its files          | `cm update <path> --machinereadable --noinput --dontmerge`               | Create and check in, once checked in; Load its files |
| Points elsewhere         | `cm xlink -e <path> <point spec>`                                        | Save, when the point changed                |
| Deletes, then adds rules | `cm xlink --deleterules <path> <rules>`, then `--addrules` | Save, when rules changed (one each at most) |

- A point spec names its repository: `cs:17@lib@acme@cloud`, `br:/main@lib@local`, `lb:v1.2@lib@local`
  (`xlinkPointSpec`).
- A rule is `br:<from>-br:<to>`, each branch a full name: `cm`'s rules parser splits it at `-br:/`, so a hyphen in a
  branch name reads right (`xlinkRuleArg`, `fullBranchName`).
- `cm xlink --show` prints the xlink's own line, then, for a writable one with rules, a localized heading and one line
  per rule, `br:/main@game@local -> br:/main/dev@lib@local [user-defined]`; the parser reads the rule lines alone. A
  branch `cm` can't find prints as its id, not a name: that rule is left out, as no name could delete or show it.
- `-s` is `--show`'s short form; both are reads.
