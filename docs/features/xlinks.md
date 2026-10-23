# Xlinks

An xlink is a folder of the workspace that shows another repository at a changeset. How the app reads items under
one (revision ids per repository, `RevisionRef`, `cm ls --tree` through xlinks) is in ARCHITECTURE.md ("Xlinks").
This doc holds how xlinks are created and edited.

## Creating and editing

Files offers **New xlink…** on a controlled folder or file (it goes in the folder, or the file's folder:
`newXlinkDirectoryOf`) and **Edit xlink…** on an xlink (`editableXlinkOf`). Both open `XlinkDialog`, whose fields,
checks and what it saves are decided by `xlinkDraft.ts` (`xlinkDialogFields`, `newXlinkOf`, `xlinkEditOf`).

- **Where it points**: a branch (its latest changeset; the default, `/main`), a changeset or a label of the
  repository picked (`RepositoryPicker`). An xlink always stores a changeset: `cm` turns a branch or a label into the
  changeset it is on as the xlink is saved, and the xlink stays there until it is edited again.
- **Writable** (`-w`): changes made under it are checked in to its repository. A read-only xlink may show a folder of
  its repository instead of all of it; a writable one can't (`cm`: "Only xlinks to root (/) are currently supported
  for writable Xlinks"), so the dialog offers the folder only while read-only.
- **Relative server** (`-rs`): the repository is looked up on the server the workspace's repository is on, for
  repositories replicated to several servers.
- **Branch expansion rules**, a writable xlink's only (`cm` refuses them on a read-only one): a change made under the
  xlink while on a branch of the workspace's repository (`from`) is checked in on a branch of the xlinked repository
  (`to`). Without a rule, `cm` picks or creates the branch itself and adds a rule for it, which `cm xlink --show`
  prints without its `[user-defined]` mark; the dialog notes those (`RuleRow.automatic`) and treats one the user
  edits as theirs. One rule per `from` branch: `cm` refuses a second, so a changed rule is deleted, then added.
- **Only where it points and its rules change.** `cm xlink -e` changes the point and keeps writable, folder and
  server; nothing changes those or the repository, so the edit dialog shows them in its description only. Moving or
  renaming the folder is Rename, Cut and Paste, as for any item.

Creating an xlink makes it a pending change (added) and editing one checks it out: the change reaches others once
checked in. Its folder stays empty until then, and fills when the workspace updates.

## `cm` commands

All in `main/cm/xlinkArgs.ts` (arguments) and `xlinkShow.ts` (`parseXlinkRules`), run by `xlinksService`. None
moves files, so each is a quick `query()`; each creates or edits an item, so it counts as the app's own write
(`changesWorkspace`), except `--show`.

| Does                     | Command                                                                  | When                                        |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------- |
| Reads the rules          | `cm xlink --show <path>`                                                 | Edit xlink… on a writable xlink, once       |
| Creates                  | `cm xlink [-w] [-rs] <path> <folder> <point spec> [rules]`               | Create xlink                                |
| Points elsewhere         | `cm xlink -e <path> <point spec>`                                        | Save, when the point changed                |
| Deletes, then adds rules | `cm xlink --deleterules <path> <rules>`, `cm xlink --addrules <path> <rules>` | Save, when rules changed (one each at most) |

- A point spec names its repository: `cs:17@lib@acme@cloud`, `br:/main@lib@local`, `lb:v1.2@lib@local`
  (`xlinkPointSpec`).
- A rule is `br:<from>-br:<to>`, each branch a full name: `cm` splits it at `-br:/` (`XlinkRulesParser`), so a hyphen
  in a branch name reads right (`xlinkRuleArg`, `fullBranchName`).
- `cm xlink --show` prints the xlink's own line, then, for a writable one with rules, a localized heading and one line
  per rule, `br:/main@game@local -> br:/main/dev@lib@local [user-defined]`; the parser reads the rule lines alone. A
  branch `cm` can't resolve prints as its GUID.
