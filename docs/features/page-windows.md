# Page windows: a page in a new window

A page that is a document about one object (a changeset's, branch's, shelve's or label's diff, a range, a file's
history, a code review, a repository browsed at a changeset: `isMovablePage`) opens in a window of its own, to read
beside the workspace's window, often on another display. A merge stays in the workspace window: it writes to the
workspace, and that window is where the user resolves and checks in. The views (Changes, the Branch Explorer…) never
leave it: they are the workspace window, and "one window per workspace" holds (ARCHITECTURE.md "Windows").

## Where it's offered

The feature is optional, so it stays quiet:

- **A page's breadcrumb**: a small icon button at its end, "Open in new window" (`PageFrame`). The page moves: it opens
  in the new window, and the workspace window goes back to what was under it (`movePageToNewWindow`), after asking
  about unsaved edits as any way out does (`afterLeaving`).
- **The object's menu**: "Open diff in new window" (changesets, branches, shelves, labels) and "Open review in new
  window" (code reviews), right after "Open diff" / "Open review" (`diffInNewWindow`, `reviewInNewWindow` in
  `menuWords`), so also in each details panel's "More actions". A shelve's diff drops it from its own menu: its
  breadcrumb moves it.

"Undock" was considered and dropped: it's IDE jargon, and it promises docking back, which there isn't. "Open in new
window" is what browsers and the official client say.

## The page window

- **One page, nothing else** (`PageWindowScreen`): the top bar with the page's title (and a way back to the page it
  came from within the window, never past the one it opened on: `pageWindowGoBack`), and "Follow selection" at its
  end. No sidebar, status bar, command log or folder drop. Its title is "<page> — <workspace>".
- **Its address names its workspace and page** (`pageWindowQuery`, read by `openPageWindowFromAddress` before the first
  render), and keeps them: a reload shows the page again.
- **It belongs to the workspace window it was opened from** (`PageWindowRegistry`; one opened from a page window
  belongs to that one's owner). It closes with it, and once it shows another workspace or the home screen
  (`workspaceShown`, from `workspaces.watch` and `unwatch`). It isn't a workspace window (`WorkspaceWindows.all`):
  opening its workspace brings the workspace window forward, and it isn't saved for the next launch.
- **Where it opens**: where the last page window was left (`pageWindowBounds`, saved apart from the workspace windows'
  `windowBounds`), so once dragged to the second display, the next one opens there; cascaded from the last page window
  still open; the first time, cascaded from its workspace window.
- **Commands**: going to a view (⌘1…, the palette) brings the workspace window forward on it
  (`usePageWindowCommands`, `windows.showWorkspaceWindow`); a menu bar command the page window doesn't have (Switch
  branch, Update workspace…) runs there the same way (`useMenuCommands`). The Window menu lists each page window under
  its workspace window.
- **Its commands show in its workspace window's command log** (`commandLogOf`).
- **A write run from it** (reverting a file from a history, say) refreshes the workspace window too, and the other way
  round: the watcher drops the app's own writes, and only the window that ran one refreshes after it, so the other
  windows showing the workspace hear it once it settles as a change on disk (`writtenBy`, from
  `ignoreOwnCommandWrites`).

## `cm` economy

- **Moving a diff costs no `cm diff`**: the workspace window hands the files it already read to the page window
  (`pageWindowOpening`, `windows.openPage`'s `diff`), whose first `diff.entries` for that target takes them
  (`HandedOverDiffs`: each one once, the last few kept). Its contents are read as any diff's, from disk first.
- **Following reads only where the selection stops**: a selection settles (`useSettledValue`) before the page window
  shows it, so arrowing through a list runs one `cm diff`, for the row it stops on; and a page already showing that
  object stays as it is (`pagesForFollowed`).
- **Nothing crosses while no window follows**: details panels send their selection to main
  (`windows.selectionShown`) only while a page window follows (`selectionFollowed`).

## Follow selection

Off by default: the window shows what it was opened on, so two changesets can sit side by side. On ("Follow
selection", a chip in its top bar that lights up), it shows the changes of what is selected in its workspace window:
a changeset, branch, shelve or label's diff, or a code review, whichever view selects it (each details panel says what
it shows: `useShowInFollowingWindow`). A selection without changes to show (the pending changes in the Branch
Explorer, another view's rows) leaves the page as it is. One page window of a workspace window follows at a time: the
latest turned on takes it from the one before (`PageWindowRegistry.follow`). The word "pinned" for the default was
dropped: naming what the option does reads plainer than naming its absence.
