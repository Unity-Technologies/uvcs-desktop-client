# Links (`uvcs://`)

A `uvcs://` link opens a changeset, a branch, a shelve, a code review, a file at a line… in the app, from a chat, a
ticket, a review comment or an AI agent's answer. People copy them from the app to share what they're looking at; agents
write them so the user can click and see.

## The grammar

A link reads as a path, never a query (no `?file=…&line=…`): what it names, then a page inside it, then lines.

```
uvcs://<server>/repos/<repo>[/<object>][/-/<page>[/<path>]][#<lines>]     repository links: shareable
uvcs:///<workspace folder>[/-/<page>[/<path>]][#<lines>]                   workspace links: this computer only
```

- **Repository links** name a server and a repository, never anything of the person who copied them (their workspace,
  their folders), so they open for anyone with access. They are the only links the app writes.
- **Workspace links** have no server, as `file:///` has no host: they name a folder on this computer, written as
  `file:///` writes it (`uvcs:///C:/wk/game` on Windows). They are for agents and scripts on the same computer ("open
  the file I just changed in Changes"); the app never copies one. A workspace on a network share named by its UNC
  path (`\\server\share\wk`) has no workspace link: the link has no room for the share's host.
- **`/-/`** separates the object from a page inside it, after every object, as GitLab does: a branch's name holds `/`,
  so nothing else could tell where it ends. A branch or folder named `-` is written `%2D`.
- **Lines** go in the fragment: `#L42`, `#L40-L52`; in a diff, a line only the older side has (a deleted one) is
  `#old-L42`.

### Repository links

| Link | Opens |
| --- | --- |
| `…/repos/game` | the repository: a workspace on it (see "Opening a link") |
| `…/repos/game/-/<view>` | a view of that workspace: `changes`, `incoming`, `files`, `changesets`, `branch-explorer`, `branches`, `labels`, `shelves`, `attributes`, `code-reviews`, `locks`, `sync` |
| `…/repos/game/-/files/<path>`, `…/-/changes/<path>` | the Files view, the item revealed; Changes, its change selected |
| `…/repos/game/-/browse[/<path>]` | the repository at the head of /main, the item selected |
| `…/repos/game/-/history/<path>`, `…/-/annotate/<path>` | the item's history, or the item annotated, as the workspace has it |
| `…/changesets/4207` | the changeset's diff |
| `…/changesets/4200..4207` | the diff of a range: what 4201 to 4207 changed |
| `…/branches/main/task001` | the branch's diff |
| `…/labels/v1.2`, `…/labels/v1.1..v1.2` | the label's diff, or between two labels |
| `…/shelves/12` | the shelve's diff |
| `…/code-reviews/311`, `…/merge-requests/311` | the code review |

A workspace link takes the same views and pages but `browse` (`uvcs:///wk/game/-/history/a.cs`); its item is the
workspace's own.

Pages inside an object (`…/<object>/-/<page>`):

| Page | Shows | Objects |
| --- | --- | --- |
| `files/<path>` | the object's diff, on that file | all |
| `browse[/<path>]` | the repository as it was there, the item selected | changesets, branches (the head), labels |
| `history/<path>` | the item's history, from there | changesets, branches, labels |
| `annotate/<path>` | the item annotated as it was there | changesets, branches, labels |
| `branch-explorer` | the Branch Explorer, on the object | changesets, branches, labels |

`…/changesets/4207/-/files/Player.cs` is the change to `Player.cs` in 4207; `…/changesets/4207/-/browse/Player.cs` is
`Player.cs` as it was at 4207.

### Writing the parts

- **Server**: a Unity organization's `@` becomes `.` (`acme@unity` → `acme.unity`, `acme@cloud` → `acme.cloud`), as
  the official client's links write it; any other server as it is (`host:8087`, `local`). An `ssl://` or `udt://`
  isn't written: the server is known by its host and port, and the app reaching it uses the protocol it already uses
  there (`sameServer`). An organization's id form (`2398571046213@cloud`) is never written ("Unity organizations",
  ARCHITECTURE.md).
- **Branches** lose their leading `/`: `/main/task001` → `branches/main/task001`.
- **Repository names** are one segment: a `/` in one is `%2F`.
- **Everything else** (each folder or branch name, a file's name) is percent-encoded as UTF-8 (`%20` for a space).
  The app writes a `+` as `%2B` and reads a bare `+` as a space, as the official client's links write spaces.
- **Labels**: a dot next to another, or ending the name, is `%2E` (`encodeLabel`), so `v1..2` is never read as a
  range of two labels.
- **What no link carries**: a name decoded to a line break, a quote or a backslash, a `/` anywhere but a repository's
  name, `.` and `..`, a number past a safe integer: `parseLink` refuses them (`decodedAll`, `idIn`, a link pasted from
  anywhere being untrusted text). So the app offers no link to a file, branch or label named with one (`writesAsLink`):
  a quote and a backslash are legal in a name on macOS and Linux.
- `formatLink` writes every link, `parseLink` reads them (`shared/links`); every link the app offers round-trips.

### Older links

The official client's `plastic://` links open here with their scheme changed to `uvcs://`: the app reads their shapes
(`parseLink`) and only ever writes its own (`formatLink`).

| Older shape | Read as |
| --- | --- |
| `…/changesets/4207/diff` (and branches, labels, ranges) | the object: its `/diff` is dropped |
| `…/shelvesets/12/diff` | `…/shelves/12` |
| `…/repos/game/path/<path>` | `…/repos/game/-/files/<path>`: the item in the workspace's Files |
| `…/branches/<b>/path/<p>`, `…/changesets/<n>/path/<p>` | `…/-/browse/<p>`: the item as it was there |
| `…/code-reviews/311/reviewchanges`, `…/conversation` | the code review |
| `?ui=gluon` | ignored |
| `<server>/repos/a/b/changesets/…` (a `/` in the repository's name) | the repository `a/b` |
| `uvcs://showchangeset=<spec>` (and `showbranch`, `diffchangeset`, `diffbranch`), the spec as `cm` names it with its repository (`cs:12@game@acme@cloud`) | the object the spec names |

The command palette takes a `plastic://` link as it is too, and the official client's web page around one
(`https://cloud.unity.com/…/desktop?url=plastic://…`), as people paste what they were sent.

## Opening a link

A link never changes anything: it opens a page. It never switches a workspace, updates it, merges, applies a shelve or
creates anything without the user saying so in a dialog. A diff, a review, a history or a browse reads the server;
the workspace only gives the page a window and a repository to read.

1. **The OS hands it to the app** (`receiveLinks`, `main/links`): macOS as `open-url` (listened to before Electron
   finishes launching), Windows and Linux as the argument after `--uvcs-link --` (`linkArgument`), at launch or to the
   running app (`second-instance`). Such a launch names nothing else: the command line is read for no folder or
   switch, so a link can't slip one in. A development run takes a `uvcs://` argument as its link too
   (`npm run app:debug -- uvcs://…`). A link arriving before the first windows opened, often the one that launched
   the app, waits for them (`LinkRequests`): the session opens as usual, then the link goes to its window in front.
2. **The window that takes it** (`WorkspaceWindows.openLink`) is the focused workspace window (a page window's own
   workspace window for a page window), else the last one used, else a new one on the home screen. It comes forward
   and takes the link once (`windows.takeLink`, told by `linkRequested`).
3. **The page reads it** (`openLink`, `parseLink`). A link it can't read says why in a dialog, never silently; one
   naming a page this version doesn't know says the app may need an update and offers to check (`showLinkFailure`).
4. **The workspace** (`linkDestination`, from the workspaces and their repositories the home screen reads, all local:
   `cm workspace list`, `cm wi`; `cm status` only for one `cm wi` names by an organization's id, and only when its
   repository's own name is the link's):
   - a workspace link: the workspace holding that folder (`workspaces.locate`: `cm getworkspacefrompath`, then both
     paths with their links followed, as `cm` names the root as it is on disk: `/private/tmp/wk` for `/tmp/wk` on
     macOS, a junction on Windows); a folder in none says so. A file named with no page shows in Changes when it has a
     pending change, in Files otherwise.
   - this window's workspace, when it is on the repository;
   - else another window's, the last focused first, which comes forward and opens it (`windows.openLinkIn`);
   - else the only workspace on the repository, in this window if it shows the home screen, else in a new one: the
     workspace a window shows is never left for a link;
   - else, with several, the user picks one (`pickLinkWorkspace`: name, branch, folder; the most recent first);
   - else, with none, "No workspace on game yet" offers to create one (`offerNewWorkspace`, then the New workspace
     dialog with the repository filled in, on the server as the user's profiles name it), then opens the link in it.
5. **The page** (`linkNavigation`) opens on top of the view, so Back returns to where the user was; a file is selected
   and its lines scrolled to and selected. A label's diff, and browsing a branch or the repository, first read the
   label's changeset or the branch's head (`linkLookup`: `labels.get`, `branches.get`, a light `cm find`); one that
   isn't there says so. An object that doesn't exist or can't be read says so in the page, as any page does.

Opening a link runs no `cm` command of its own beyond those reads: the page reads what it always reads.

## Where links are copied

Links are copied where people are when they want to share something, and only there: no link buttons on rows or
badges.

- **Copy ▸ Link** in every object's menu (`copySubmenu`'s `link`), so every place the menu shows has it (the view, the
  details' More actions, the Branch Explorer, the branch pill, the palette): changesets, branches, labels, shelves,
  code reviews, and a repository on the home screen. A file's menu in a diff, a review, a history or Browse
  repository has it too: the change to that file there, or the file as it was.
- **Copy link** in every page's header (`CopyLinkButton`: a diff, a review, a history, Browse repository; a page
  window's top bar too): the link to what the page is about, never the file or lines it shows (`pageObjectTarget`): a
  diff's changeset, branch, label, shelve or range, a review, a history's item at the revision shown, a browsed
  changeset at the item shown ("Copy link to shelve 2", "… to history of Player.cs": `objectLinkLabel`).
- **The lines selected**, in a committed diff, a history's annotations and a file annotated in Browse repository:
  - a quiet **"Copy link" chip** by the first of them, at the right end of its pane, as a change's "Revert change"
    sits (`LineLinkChip`, placed by `lineChipAnchor`); its tooltip says what it copies ("Copy link to lines 40–52 of
    Player.cs", `copyLinkLabel`) and the ⇧⌘C that copies it too;
  - **a right-click on code** (`lineMenu`, `useLineTools`), which first selects the line clicked when it isn't
    selected (`rightClickSelection`): "Annotate at this line" in a diff (the newer side's, `diffEntryAnnotation`),
    "Copy link to line 42" (⇧⌘C) and "Copy line" (its text, `linesText`). Changes keeps its own: its lines are picked
    to discard them, and no link names a pending change.
  - Copied from either, the toast teaches the shortcut ("⇧⌘C copies it next time", `nextTimeHint`, `copyPageLink`).
  - Line numbers say how on hover ("Click to select · Shift+click a range", `lineNumberHint`), not while dragging.
- **⇧⌘C (Ctrl+Shift+C) and the palette's "Copy link"** copy the most specific thing in front (`useCopyLinkCommand`,
  `linkToCopy`): the lines selected in the page when there are some (`pageLinkTarget`, as their chip), else the page's
  own object (`pageObjectTarget`, as its header), else the object selected in the view (its Copy ▸ Link, offered by
  `useCopyCommand`), else the view itself.
- **After a check-in or an update**, its "Copy link" copies the changeset's link, or the range's (`successLinkObject`).
- **The Files view**: an item's Copy ▸ Link, and ⇧⌘C on the selected one, copy it as the repository has it on what the
  workspace is on (`…/branches/main/-/browse/Assets/Player.cs`), which stays useful as the branch moves on; lines
  selected in its viewer get the chip and the menu, pinned to the changeset the workspace has loaded, as line numbers
  shift along a branch (`…/changesets/28/-/browse/Player.cs#L40`; `filesItemLink`, `useFilesItemLinks`,
  `LineLinks.linkOf`). It's the repository's version, never the workspace's own edits. A private or ignored item, one
  under an xlink and a workspace on a shelve offer none.
- Nothing only on this computer is copied as a link: Changes offers none (a pending change exists nowhere else), nor
  does ⇧⌘C on the Changes or Files view itself (`viewLinkTarget`), and the app writes no workspace link.

Pasting a link into the palette offers to open it, saying what it opens (`linkGroupIn`, `linkDescription`), and
File ▸ Open Link… (the palette's "Open link…") asks for one, the clipboard's already in the field (`askAndOpenLink`).
Both take a `uvcs://` or `plastic://` link, the web page around one, or a spec naming its repository
(`cs:4207@game@acme@cloud`, `linkInText`).

## Registering the scheme

The installers ask nothing more: installing the app is what makes it open `uvcs://`.

- **macOS**: `protocols` in `electron-builder.yml` writes `CFBundleURLTypes` into Info.plist; macOS learns it as the
  app is first opened.
- **Windows**: the NSIS installer writes `HKCU\Software\Classes\uvcs` (per user, no administrator) running
  `"<exe>" --uvcs-link -- "%1"`, and its uninstaller removes it (`build/installer.nsh`); electron-builder's NSIS
  writes no protocol itself. Every silent update writes it again.
- **Linux**: an AppImage registers nothing. The app writes a desktop entry for links where the desktop finds it
  (`$XDG_DATA_HOME/applications`, `~/.local/share` by default; `linuxDesktopEntry`: `Exec="$APPIMAGE" --uvcs-link --
  %u`, `MimeType=x-scheme-handler/uvcs;`, `NoDisplay`) and makes it the scheme's handler (`xdg-mime default`,
  `setDefaultLinkHandler`). The entry has an id of its own, `com.unity.uvcs-desktop.link-handler.desktop`
  (`linkHandlerDesktopId`), never the app's (`desktopName`): the launcher matches the app's windows to the entry
  named by the app's id, for their icon and progress bar, and an icon-less hidden entry there would win over the
  user's AppImage integration (AppImageLauncher, Gear Lever, appimaged), giving the app a generic icon. That is also
  why it runs `xdg-mime` itself: Electron's `setAsDefaultProtocolClient` registers only the app's own id there. The
  entry is written when missing or out of date (the AppImage moved), and only then registered; one under the app's
  id that an earlier version wrote is removed. An entry the app didn't write (marked `X-UVCS-Desktop-Managed`) is left
  alone. A package (deb, rpm) would declare the scheme in its own `.desktop`, from `protocols`.
- Every packaged launch registers again (`registerLinkScheme`: `setAsDefaultProtocolClient` on Windows and macOS), so
  the scheme comes back if another app took it. Development builds never register: they would take links from the
  installed app. `schemeRegistration.test.ts` keeps the installers' scheme and command the app's.
- The app doesn't take `plastic://`: the official client owns it.
