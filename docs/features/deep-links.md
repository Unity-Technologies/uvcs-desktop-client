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
  the file I just changed in Changes"); the app never copies one.
- **`/-/`** separates the object from a page inside it, after every object, as GitLab does: a branch's name holds `/`,
  so nothing else could tell where it ends. A branch or folder named `-` is written `%2D`.
- **Lines** go in the fragment: `#L42`, `#L40-L52`; in a diff, a line only the older side has (a deleted one) is
  `#old-L42`.

### Repository links

| Link | Opens |
| --- | --- |
| `…/repos/game` | the repository: a workspace on it (see "Opening a link") |
| `…/repos/game/-/<view>` | a view of that workspace: `changes`, `incoming`, `files`, `changesets`, `branch-explorer`, `branches`, `labels`, `shelves`, `attributes`, `code-reviews`, `locks`, `sync` |
| `…/repos/game/-/files/<path>` | the Files view, the item revealed |
| `…/changesets/4207` | the changeset's diff |
| `…/changesets/4200..4207` | the diff of a range: what 4201 to 4207 changed |
| `…/branches/main/task001` | the branch's diff |
| `…/labels/v1.2`, `…/labels/v1.1..v1.2` | the label's diff, or between two labels |
| `…/shelves/12` | the shelve's diff |
| `…/code-reviews/311`, `…/merge-requests/311` | the code review |

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
- `formatLink` writes every link, `parseLink` reads them (`shared/links`); the two round-trip.

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
| `uvcs://showchangeset=cs:12@game@acme@cloud` (and `showbranch`, `diffchangeset`, `diffbranch`) | the object the spec names |

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
3. **The page reads it** (`parseLink`). A link it can't read says why in a dialog, never silently; one naming a page
   this version doesn't know says the app may need an update.
4. **The workspace** (`linkDestination`, from the workspaces and their repositories the home screen reads, all local:
   `cm workspace list`, `cm wi`):
   - a workspace link: the workspace holding that folder (`cm getworkspacefrompath`); a folder in none says so.
   - this window's workspace, when it is on the repository;
   - else another window's, which comes forward and opens it;
   - else the only workspace on the repository, in this window if it shows the home screen, else in a new one: the
     workspace a window shows is never left for a link;
   - else, with several, the user picks one (`LinkWorkspacePicker`: name, folder, branch; the most recent first);
   - else, with none, "No workspace for game yet" offers to create one (the New workspace dialog with the repository
     filled in), then opens the link in it.
5. **The page** (`linkPage`) opens on top of the view, so Back returns to where the user was; a file is selected and a
   line scrolled to and marked. An object that doesn't exist or can't be read says so in the page, as any page does.

Opening a link runs no `cm` command of its own beyond those local reads: the page reads what it always reads.

## Where links are copied

Links are copied where people are when they want to share something, and only there: no link buttons on rows or
badges.

- **Copy ▸ Link** in every object's menu (`copySubmenu`'s `link`), so every place the menu shows has it (the view, the
  details' More actions, the Branch Explorer, the branch pill, the palette): changesets, branches, labels, shelves,
  code reviews, and a repository on the home screen. A file's menu in a diff, a review, a history or Browse
  repository has it too: the change to that file there, or the file as it was.
- **Copy link** on a diff's and a review's header (`CopyLinkButton`): the link to what the page shows, as a
  browser's address bar is, the file selected and the lines selected included ("Copy link to line 42 of Player.cs").
- **⇧⌘C (Ctrl+Shift+C) and the palette's "Copy link"** copy the same for whatever is in front: the page, else the
  selected object (`useCopyLinkCommand`).
- **After a check-in**, its "Copy link" copies the changeset's link.
- Nothing local is ever copied as a link: Changes and the Files view offer none, and the app writes no workspace link.

The palette's **Open link** (and pasting a link into the palette) opens any link: `uvcs://`, `plastic://`, or a spec
naming its repository (`cs:4207@game@acme@cloud`).

## Registering the scheme

The installers ask nothing more: installing the app is what makes it open `uvcs://`.

- **macOS**: `protocols` in `electron-builder.yml` writes `CFBundleURLTypes` into Info.plist; macOS learns it as the
  app is first opened.
- **Windows**: the NSIS installer writes `HKCU\Software\Classes\uvcs` (per user, no administrator) running
  `"<exe>" --uvcs-link -- "%1"`, and its uninstaller removes it (`build/installer.nsh`); electron-builder's NSIS
  writes no protocol itself. Every silent update writes it again.
- **Linux**: an AppImage registers nothing. The app writes its own desktop entry where the desktop finds it
  (`$XDG_DATA_HOME/applications/<desktopName>`, `~/.local/share` by default; `linuxDesktopEntry`:
  `Exec="$APPIMAGE" --uvcs-link -- %u`, `MimeType=x-scheme-handler/uvcs;`) and makes it the scheme's handler
  (Electron runs `xdg-settings`). The entry is `NoDisplay`: it names the handler only, and the desktop's menus stay
  the job of the user's AppImage integration, if any. It is written when missing or out of date (the AppImage moved),
  and only then registered, as `xdg-settings` holds the main process a moment. An entry the app didn't write (marked
  `X-UVCS-Desktop-Managed`) is left alone. A package (deb, rpm) would declare the scheme in its own `.desktop`, from
  `protocols`.
- Every packaged launch registers again (`registerLinkScheme`: `setAsDefaultProtocolClient` on Windows and macOS), so
  the scheme comes back if another app took it. Development builds never register: they would take links from the
  installed app. `schemeRegistration.test.ts` keeps the installers' scheme and command the app's.
- The app doesn't take `plastic://`: the official client owns it.
