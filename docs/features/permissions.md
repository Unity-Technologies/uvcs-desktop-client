# Permissions

Who may do what on a server, a repository, a branch, a label, an attribute or a path (a secured path). One dialog
for all of them (`openPermissionsDialog`, `features/permissions/`); every read and write is a `cm` command
(`main/services/permissionsService.ts`). This doc holds the model, the `cm` quirks and the design decisions the code
can't show.

## The model

- Every object points to an access control list (ACL). A list holds **entries**, one per user or group, and
  **inherits** from other lists: a branch, label or attribute from its repository, a repository from the server (a
  secured path from its repository). An object nobody set permissions on **shares its parent's list**: `cm showacl`
  then prints the parent's list first (`ObjectPermissions.ownAcl` false, told by `isOwnAcl` from the first list's
  creator). The first permission set on it gives it a list of its own, inheriting from the parent's.
- An entry says, for each permission, whether it's **allowed**, **denied**, and whether it **overrides** what the
  lists above allow (`overrideAllowed`) or deny (`overrideDenied`) for the same member. Two special entries: `ALL
  USERS` (every user; `--group=all` to `cm acl`) and `OWNER` (whoever owns the object; `--user=OWNER`), shown as
  "All users" and "Owner" (`memberLabel`).
- How a permission resolves for one member, as the server computes it (`PermissionCalculator.GetNotOverridden`;
  `resolvePermissions` in `aclResolution.ts`): walk the lists from the object up; each list's entry counts but for
  what a closer list overrode, and adds its own overrides for the lists above; lists inherited side by side allow only
  what all allow and deny what any denies; **a deny wins over an allow**. On the server a user's check also merges
  their groups' entries, `ALL USERS` and (when they own it) `OWNER`, and administrators skip the check; the dialog
  shows each entry's own result ("for this entry"), as the official client does.
- Which permissions apply to each kind of object is the server's table (`ClientPermissions` in the official client):
  `APPLICABLE_PERMISSIONS`. A path takes the item permissions its check-ins are checked against plus who may change
  it; `view` is hidden there, as the official client hides it. `purge` is left out everywhere: `cm` knows it only
  where purges are enabled.

## `cm` commands and their quirks

| What                    | Command                                                                                     | Via     |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------- |
| Read a list and parents | `cm showacl <spec> --extended`                                                              | `query` |
| Read the owner          | `cm showowner <spec>`, only when the list the object came from didn't read it (`knownOwner`) | `query` |
| Groups and users        | `cm listusers <server> --onlygroups` / `--onlyusers` [`--filter=`]                          | `query` |
| Set an entry            | `cm acl --user=\|--group= -allowed=+a,-b -denied=… -overrideallowed=… -overridedenied=… <spec>` | `query` |
| Set the owner           | `cm setowner --user=\|--group= <spec>`                                                       | `query` |
| Remove a secured path   | `cm acl --delete path:…`                                                                    | `query` |
| A group's branches      | `cm acl path:…#tag --branches=+a,-b`                                                        | `query` |

Specs: `permissionSpec` (`repserver:local`, `rep:game@local`, `br:/main@game@local`, `lb:`, `att:`,
`path:/src[#tag]@game@local`). They name their repository, so the commands run from anywhere, the home screen too.

- **`--extended` is read as text** (`parseExtendedAcl`, by indentation): `--xml` prints only allowed and denied (an
  override reads as neither), and `--extended --xml` fails in cm 11 ("ExtendedAclInfo is inaccessible due to its
  protection level"). Its words (`ACL:`, `Creator`, `Entries`, `Inherited`, `Allowed:`, `Override Denied:`…) are
  written in `cm`'s code, never localized. `all` stands for every permission but `advancedquery`
  (`ALL_KEYWORD_PERMISSIONS`); output with no list fails rather than reading as no permissions.
- **A creator's spec may name another server** than the object's (the client's default one: `br:/main@rep:game@
  repserver:codice@cloud` for a local repository), so `isOwnAcl` compares only the kind and the name.
- **`cm acl` changes an entry from what it says now**: each option lists permissions to add and take away, so
  `aclArgs` writes only what differs, and an entry left with nothing is removed by the server (there is no remove
  option). What it changes from is the first list `cm` shows: for an object sharing its parent's list, **the
  parent's entry for that member, which the first command copies** into the object's new list. `aclCommands` starts
  that first command from the parent's entry, restating every permission so it runs even when the copy already says
  it all, and the following ones from nothing. The changes are sent with the list as the dialog read it (`seen`), so
  only the user's edits are written, never a stale copy of the rest.
- One `cm acl` per changed entry (it takes one user or group); the owner last, since giving the object away can take
  away the right to change its permissions (through the `OWNER` entry). A failure stops there; the dialog reads the
  permissions again and what went through drops out of its changes.
- **`cm acl --user=` or `--group=` must match** what the member is, and `cm showacl` doesn't say: the server's groups
  (`cm listusers --onlygroups`, once a session) tell them apart (`memberRef`).
- **No `cm` command lists secured paths**, nor a group of branches' branches (only the official client's API does).
  `cm showacl path:/src@…` fails naming the spec ("Incorrect object specification") when the path isn't secured: the
  service then reads the repository's list, the one setting a permission would start from, and the dialog says so.
  The first `cm acl` on the path secures it; `--branches=` with a tag creates a group of branches.
- **`cm acl … --branches` fails after doing its work** when the repository's server isn't `cm`'s default one: it
  looks the branches up on the default server to print them ("Could not find a part of the path …branches.dat").
  `savePermissions` reads the permissions again after any failure, and when they say everything asked
  (`changesLanded`) it reports the save as done, quoting `cm`'s error.

## The design

- **One dialog, wherever the object shows.** Title "Permissions", the object in words (`describeTarget`), the owner
  with Change…, the users and groups on the left (`MemberList`), what the one picked may do on the right
  (`PermissionGrid`). A notice says when the object shares its parent's list, a path isn't secured or a group of
  branches is new (`ownListNotice`).
- **Inherit, allow or deny**, one choice per permission instead of the official client's two checkboxes and two
  override toggles: the row shows the choice, the **result** ("Allowed", "Denied", "Not allowed") and **where it comes
  from** ("here", "the server", "repository game"; `sourceLabel`). The row picked opens its details: the definition,
  what the lists above say (`aboveSentence`), and the two overrides in plain words, "Ignore allows from above" and
  "Ignore denies from above", so every combination the server stores stays reachable. An allow a deny above beats
  says so, with **Allow anyway** (ignoring denies from above). Back to Inherit clears the overrides too.
- Permissions read in plain words, grouped by what people do (`permissionCatalog.ts`), each with `cm`'s name beside
  it (`ci`, `mkchildbranch`): it's the name the security guide, the server's log and `cm acl` use, which
  administrators know them by. A filter finds them by either.
- **Edits are staged** in a draft (`permissionsDraft.ts`) and saved at once: the footer counts them and lists them in
  words with an undo each (`changeLines`); Save says how many. Saving asks first when it removes an entry, denies
  "Change permissions" or gives the object away (`needsConfirmation`); closing with unsaved edits asks to discard
  them.
- **Keyboard first**: the members list and the grid are one Tab stop each; ↑ ↓ move, ← → step through the choices,
  A, D and I pick one, the remove shortcut removes the member's entry, ⌘↵ saves (`lib/shortcutRegistry.ts`, area
  Permissions; bound in the dialog, as a modal dialog keeps window shortcuts off).
- Adding a member (`pickMember`) searches the server's users and groups, All users and Owner first; its entry starts
  empty, following what's above, and the bulk buttons (Allow all, Deny all, Inherit all, on the permissions shown)
  set it in one step. A server whose directory can't list everyone (an LDAP size limit) is searched as typing pauses
  (`--filter=`). The owner is picked the same way, without the special entries.
- Only an entry set here can be removed (one set above is changed where it's set, or overridden here), and the
  server keeps at least one (`cannotRemoveReason`).
- **Paths**: the dialog shows which path (typed, from the root) and on which branches, all of them or a group named by
  its tag (`PathScope`); a new group asks for its branches (full names apart by commas). A secured path offers
  "Remove path permissions…" and, for a group, "Branches of <tag>…" (add some, take some out: the ones it has can't
  be read).
- Saving reads every object's permissions on that server again (`queryKeys.permissionsOn`: objects inherit from each
  other) and, in the workspace, refreshes only the lists showing an owner that changed (`isAffectedByPermissions`).
  The permissions are read as the dialog opens and never on focus, so what the edits are made on stays put.

## Where it's reachable

| Object      | Places                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| Branch      | `branchMenu`: Branches view, details' More actions, Branch Explorer, switcher, top bar, palette       |
| Label       | `labelMenu`: Labels view, details, Branch Explorer, top bar, palette                                  |
| Attribute   | `attributeTypeMenu`: Attributes view                                                                 |
| Path        | `fileMenu` "Path permissions…" on a controlled item (not under an xlink: it lives in the xlinked repository) |
| Repository  | Home's repository menu (Permissions…, Path permissions…, Server permissions…); palette "Repository permissions…", "Path permissions…" |
| Server      | Home's server header (Server permissions…), the repository menu; palette "Server permissions…"        |

The words live in `MENU_WORDS` (`permissions`, `pathPermissions`, `serverPermissions`), in the edit group.
Changesets and items have ACLs `cm showacl` reads, but `cm acl` sets none on them, and the official client offers
none: neither does the app.

Rejected, so they aren't proposed again:
- **Two checkboxes (Allowed, Denied) and two "override" toggles per permission**, the official client's grid: four
  controls whose combinations the user had to work out; the choice, its result and its source say it at once.
- **Ctrl+P / ⌘P for Permissions…**, the official client's shortcut: it's Go to file here. The palette's commands and
  the menus reach the dialog instead.
- **Listing every secured path of a repository**, as the official client's Path permissions does: no `cm` command
  lists them, and the server's API would need credentials of its own outside `CmClient` (as lock rules would:
  docs/features/locks.md).
- **Writing a whole entry with every permission's `+` or `-`**: exact, but the command log would show 29 names in four
  options for a one-permission change, and an edit made meanwhile by someone else would be overwritten.

Try it against `scripts/sandboxes/permissions.sh` (repository `permissions-demo@local`): it never touches the server's
own permissions.
