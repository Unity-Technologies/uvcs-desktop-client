# Accounts and sign-in

How the app tells the user's accounts apart and where it shows them, and how it knows that a server needs the user to
sign in again, and what a window shows then. Signing in stays with the official client and the command line for now:
`cm` keeps the profiles and the sign-ins, and the app reads what `cm` says, never writing it, but for removing a
profile.

## Accounts

`cm` keeps one profile per server (`cm profile list`: a name, a server, a user and how it signs in). The app shows
accounts, as people think of them, made of those profiles (`userAccountsOf`, `shared/domain/userAccounts.ts`;
`UserAccount` in `shared/domain/account.ts`):

- **A Unity account**: every cloud profile of one user, whatever the case of the email (`acme@unity`, `acme@cloud`),
  its organizations. A `*@cloud` profile, which `cm` signs in to every cloud organization with when the organization
  has no profile of its own, belongs to its user's account too, and makes one even with no organization listed.
- **A server's account**: a server's profile, its own account. The same user on Unity Cloud and on a server is two
  accounts.
- **This computer** (`local`) belongs to no account: it needs no sign-in, and Home always lists it.

Unity accounts come first, by user, then servers' by server. An account's id (`cloud:<user in lower case>`,
`server:<server>`) stays the same from one read to the next, so a choice made by it (the account Home shows) holds.

A window derives the accounts from the profiles it reads anyway (`useUserAccounts`: `accountsQuery` with
`userAccountsOf` as its `select`), so they cost no command of their own. In main, the profiles, the servers and the
setup check share one `cm profile list` (`ProfileList`, docs/ARCHITECTURE.md "Windows"), and the home screen asks for
the profiles with the servers as it starts (`readFirstScreen`, `prefetchStartupQueries`), so both take that one
command. The accounts are as fresh as the profiles: read again when the window regains focus a minute after the last
read, so an account added with the official client or the command line shows up then, and after a profile is removed.
The servers the home screen, the server pickers and links read (`serversQuery`) keep the same freshness
(`PROFILES_STALE_MS`), so they refetch on the same focus and share that one command.

Which account a server belongs to is decided in one place for every view (`accountOfServer`, over
`accountForServer`): its own profile by server or by name, an organization by its name or its genesis id on
`@cloud` or `@unity`, else the account holding `*@cloud`.

## Home

The home sidebar lists the organizations of one Unity account at a time, under a switcher at its top
(`AccountSwitcher`): the account's avatar and email, and a menu holding each Unity account (the one shown checked)
when there are two or more, then "Manage accounts…" (Settings › Accounts). Folded, the switcher is the avatar alone.
Without a Unity account there is no switcher. The palette offers "Switch account to …" for each Unity account when
there are two or more (`accountSwitchCommands`), on the home screen only.

- **Which account shows** (`homeAccountOf`), the first that names one: the account holding the repositories on screen
  (a link may open another account's organization), the one picked in this window since it came to the home screen,
  the account of the workspace the window left (from the workspace's info the window read while it showed it, never
  read again for this), the one last picked in any window (`AppSettings.homeAccount`), else the main one: the
  account holding the `*@cloud` profile, else the one with the most organizations (`mainAccountOf`), never merely the
  first by name, which may be an email account with one. A home screen where nothing was picked, and that no workspace it
  left names an account for, follows the account last picked in another window as it's picked: the choice is one for
  the app, not per window.
- **What it lists** (`homeServersOf`): this computer, the shown account's organizations, and every server's account,
  a server's entry showing its user (`serverEntryDetail`), as a server is an account of its own.
- **Favorites** (`AppSettings.favoriteOrganizations`, by server): someone in dozens of organizations keeps the ones
  they use in sight. A star on an organization's row (on hover or keyboard focus, as long as the sidebar isn't folded),
  its right-click menu (`organizationMenu`, which also copies its name and link) and the star in its page's header (`FavoriteOrganizationButton`) add it or take it out.
  The sidebar lists the favorites first, under Favorites, and only there (`serverGroups`); every group stays by name, as
  a list that orders itself by use moves under the user's hand. The main process changes the list
  (`withFavoriteOrganization`), so two windows don't overwrite each other's; it changes nothing in `cm`.
- **The filter** (`OrganizationFilter`): from ten organizations, Unity and cloud ones together
  (`showsOrganizationFilter`, `ORGANIZATION_FILTER_MIN`), a search field above them keeps the
  organizations whose name holds every word typed, and marks them, by every list's rule (docs/architecture/lists.md "Filters"); this computer and the servers, few, always show. Most people have one to
  three organizations and never see it. Picking another account empties it, and going back finds it empty
  (`typedFilterFor`); folded, the sidebar shows none and filters nothing (`sidebarFilter`). It shows by count, not when More appears,
  which depends on the window's height: a filter that came and went on a resize would look broken.
- **Picking an account only shows it** (`showHomeAccount`): it changes nothing in `cm`, and is remembered in the app's
  own settings, never `cm`'s. Repositories of the account left give way to the welcome (`sectionAfterSwitch`, by the same `accountOfServer`:
  the repositories of an organization the account holds by any of its names stay). The
  official client rewrote the server's profile on every pick; with one profile per server, two accounts in one
  organization overwrote each other. A link that writes a server in another case (`Games@unity`) keeps its
  repositories on screen, as servers are matched whatever their case.

## Settings

Settings › Accounts has one row per account (`accountRowsOf`): its user, then "Unity · 3 organizations" or the server
and how it signs in; the account signing in to the window's place first, marked "This workspace". A Unity account's
row opens to its organizations, by their readable names (`organizationName`, never a genesis id), then its `*@cloud` profile ("Any cloud organization"), each removed apart with
`cm profile delete` (its question names it as the row does, `profileLabel`); a server's row removes its one profile itself. Removing a whole account at once isn't offered:
`cm profile delete` leaves the account's sign-in behind, so a loop of them signs nothing out. This computer's profile
isn't listed, as it belongs to no account. The account menu's count is the rows'.

## Sign-in state: one per server

A session ending is a state of a server, not an event of a command. The main process keeps one state per server for
the whole app (`ServerSessions`, `main/accounts/`): a server it holds nothing of counts as signed in; one that needs a
sign-in holds its `SignInProblem` (`shared/domain/signIn.ts`): the kind, the server, and the command and output that
found it (Details). Every window hears each change (`serverSessionsChanged`) and reads the list once as it starts
(`accounts.sessions`, `useServerSessions`). The same problem told again changes nothing, so no event repeats.

The kinds (`SignInProblemKind`) and what the screen says of each (`signInWords`), the server named as the rest of the
app names it (`describeServer`: an organization by its name, the local server as the server on this computer):

| Kind                 | Words                                                  |
| -------------------- | ------------------------------------------------------ |
| `signInRequired`     | You're not signed in to {server}                       |
| `sessionEnded`       | Your session for {server} ended                        |
| `credentialsRefused` | {server} didn't accept your user or password           |
| `noLicense`          | Your account has no license on {server}                |
| `locked`             | {server} locked this account for now                   |

## How `cm` says it

`cm` has no error codes: its failures are free text, exit code 1, and a sign-in it can't renew makes it ask on its
console (a user, a password, which system to sign in with), which the app stops (`WaitingForInputError`,
`main/cm/consolePrompts.ts`; ARCHITECTURE.md "No external tool opens by itself"). `signInFailureOf`
(`main/cm/signInFailure.ts`) is the one place that reads `cm`'s words about signing in: whole English sentences, each on
a line of its own (an expired token, a refused password or user, a deactivated license, no seat left, a locked
account, the prompts), never loose words, as an update's progress names files (`credentials.txt`) and a failed
check-in can quote its comment. `cm checkconnection` is read the same way, and a prompt it was stopped at means a
sign-in too (`classifyConnectionCheck`); never loose words such as "authentication failed", which a secure connection
that fails prints ("…because the remote party has closed the transport stream"): the server is out of reach then.

`cm` doesn't say which server a sign-in failure is about, so a failure alone never marks a server (see "The gate").

## The gate

Every command goes by a gate in `CmClient` (`SignInGate`, `signInGate`, wired by `trackSignIns` in
`main/startup/signIns.ts`):

- **A command's server** is the one it names (`CmRunOptions.server`: `cm checkconnection <server>`, `cm repository list
  <server>`, a repository's place, which `cmPlace` names) or its workspace's, which `WorkspaceServers` learned from the
  header the window read as it opened the workspace (`workspaces.info`): no command of its own. Only a folder the
  command was given counts: one run in any directory (`anyDirectory`: `whoami`, a glance at another workspace's
  header) runs in the shown workspace's folder by chance, so it isn't gated. A command whose server isn't known is
  never gated. One that fails for a sign-in learns its workspace's server with two local reads
  (`learnServerOf`, `WorkspaceServers.learn`, `readWorkspaceOrigin`: its root, and the machine-readable header with
  `--compact`; remembered under the root, for all its folders),
  as that header's own read (`cm status --header --xml`) asks the server for the branch's head, and is what fails when a
  workspace opens while its server needs a sign-in. A folder in no workspace learns none, and the failure stays a plain
  `CmError`: the gate never guesses.
- **A server that needs a sign-in gets no server command**: `CmClient` refuses it before `cm` runs, with a
  `CmSignInError` carrying the problem, and logs it as not run (`notRun`, "Not run: sign in to {server} first."), so the
  command log explains itself without pointing at it as a failure (`isUnseenFailure`). No prompt, no dead credentials
  repeated against the server's throttle of failed sign-ins, no pile of errors. Local commands (`LOCAL_COMMANDS`) and the
  check itself (`cm checkconnection`) still run, but a `cm status` that works out the workspace's header, which asks the
  server for its branch's head (`needsSignIn`): the pending changes (`--compact`) still read.
- **A command that runs into a sign-in problem** (`signInFailureOf`, or a prompt it was stopped at) fails as one only
  once a check of its server confirms it (`SignInGate.confirm`, `SessionChecks.confirm`): one `cm checkconnection`,
  joined by every failure that started before it, and answering those that follow it within `CONFIRMED_REACHED_MS`
  (5 s), so a burst of failed reads costs one check, an xlink's too. A false "session ended"
  would cover a healthy window, and the failure may be another server's: an xlink's sign-in fails a workspace's command
  while the workspace's own server is fine. Then the command fails as before, with `cm`'s words. A server already known
  to need a sign-in is answered at once, with no check: local commands still run while it does, and fail so.

The window gets the problem with the error (`RemoteError.signIn`, `ApiError.signIn`, `signInProblemOf`).

## Options that stick to a shell

A `cm shell` keeps a command's global options for every later command of its session: who it signs in as and with what
(`--server`, `--username`, `--password`, `--token`, `--workingmode`), the files it reads its sign-in and organizations
from (`--clientconf`, `--tokensconf`, `--cloudregionsconf`, `--unityorgsconf`, and the older `-clientconf`, which `cm`
reads first), the cache server (`--cacheserver`, `-cacheserver`), encryption settings (`--encryptmethod`,
`--encryptpassword`, `--encryptserver`), the workspace (`-wks`) and the folder it works in (`-path`). A pooled shell runs
every quick read of its folder, so one command carrying one would change what all the others sign in as, or where they
run. The app never sends them through a shell:
`CmClient`'s quick commands refuse them as a programming error (`STICKY_SHELL_OPTIONS`, `refuseStickyShellOptions`, in
`fakeCmClient` too), and no main-process source passes them at all (`noStickyShellOptions.test.ts`). A command that
needs one runs with `execute()`, in a process of its own, where it ends with the command; the logs hide the secrets
among them (`SECRET_OPTIONS`: `--password=`, `--token=`, `--encryptpassword=`).

## Keeping sessions alive

A sign-in lasts while it is used: `cm` renews it by itself on the next command, and what ends a session is mostly not
using it (the provider stops renewing it), a password change or an administrator. So the app checks a window's server
(`cm checkconnection`, `accounts.checkSession`, `useWindowSessionCheck`):

- as the window opens its place, and **every time the window comes forward**, where main runs a check only when the
  server's last one is older than `SESSION_CHECK_STALE_MS` (10 minutes), or while the server needs a sign-in, but for
  a refused password or a locked account (`credentialsRefused`, `locked`): each check would send the stored password
  again, and a few activations would lock a directory account (LDAP, Active Directory). Only Check again checks those. The
  check renews the session as a side effect, and finds a dead one as the user comes back, before they act. Activating
  a window twice within ten minutes runs nothing; alt-tabbing all day runs at most six checks an hour per server.
- one check per server app-wide, joined by every window that asks (`SessionChecks`); never on a timer: an app nobody
  looks at asks nothing.
- by the screen's Check again (`checkSessionNow`), at once.

A check that finds the server signed in after it needed a sign-in restarts the pooled `cm shell` sessions
(`CmClient.restartShells`, `CmShellPool.restartSessions`), as a session keeps the sign-in it read as it started. So
does a check that finds the server fine after a pooled session's read failed for a sign-in: the user signed in again
elsewhere before any check found the session ended, and the sessions still hold the old sign-in. Only that server's
sessions restart (its workspaces' folders, `WorkspaceServers`, and those whose server isn't known), once a burst: a
failure within `SHELL_RESTART_SPACING_MS` (10 minutes) of a restart that didn't help (an xlink's sign-in, which none
mends) restarts nothing, and one later restarts them again (the session ended again, and was signed in again
elsewhere). A
server out of reach changes no state: it may need no sign-in at all, a window on it keeps working with what's local,
and the corner card says it can't be reached (`ConnectionProblemCard`).

## The sign-in screen

A window whose place's server needs a sign-in (`signInCovering`) is covered by one screen under its top bar
(`SignInCover`, `SignInScreen`): the window's buttons, Home and the place stay. A page window (a diff, a history in a
window of its own) is covered the same way, without Go to Home (docs/features/page-windows.md); every window showing a
place's views or pages is (`placesCoveredBySignIn.test.ts`), as the failures of what the server refused raise no toast
in them. The work shows through it blurred
(`--scrim-sign-in` and a blur; opaque with reduced transparency), so the user sees it's all still there, and the message
sits on a card. What the view draws in layers of its own (a model viewer's labels and toolbars, floating cards) stays
under it: while covered (`.covered[inert]`), and only then, the covered part is a stacking context of its own
(`isolation`), as a view's own overlays must otherwise lie over the window (docs/architecture/renderer.md, Styling, Overlays). It is the window's state, not a dialog:
it appears in place, moves no focus between windows, and is one however many reads failed. What it covers stays
mounted and `inert` (nothing takes focus or clicks), so what was typed or selected (a check-in comment, a review
draft) is there again afterwards. Nothing works on the place while it's covered: the keys of what it covers are off
(`PlaceCoveredContext`, read by `useShortcut`), and so are the place's commands, from their shortcuts, the palette and
the app menu (`commandsWhileCovered`, `useSignInCover`): only the app's own (`app.…`: Home, Settings, a new window,
About) and the screen's buttons work. Menus a covered view opened close as it covers it (a press outside them), but a
dialog stays, with what was typed in it. Only that server's windows are covered: windows on other servers and Home keep
working.

Today it says what happened, that the sign-in is the Unity Version Control app's ("Sign in there again, then check
again"), and offers Check again, Details (`ConnectionProblemDialog`: `cm`'s words and the command, and the app to
download where signing in again is the way forward) and Go to Home. Signed in elsewhere (the Unity Version Control
app, a terminal), the next check notices: Check again, or coming back to the window.

A workspace opened while its server needs a sign-in can't be read (its header asks the server), so the same screen
takes the window's place, as a workspace that can't be opened does (`workspaceSignInProblem`, `WorkspaceGate`,
`SignInScreen` with `as="page"`), and coming back to the window checks that server too (`serverToKeepChecking`).

Once the server is signed in again, every window on it is uncovered, and reads once more each query whose last read
failed for its sign-in (`failedForSignInTo`, `useServerSessionsFromMain`): a workspace that couldn't be opened opens.

## Operations refused

An operation or an action refused because its place's server needs a sign-in (`refusedForSignIn`, in `runOperation`
and `runAction`) raises no error toast: the screen already says. What its caller names to run `again` (`OfferedAgain`:
the user's whole action, never the step that failed: a check-in from its panel, with its catch-up when the branch
moved and its comment cleared once in, `checkinFromPanel`; one from Files with the comment already given) is
remembered (the last one, forgotten when the window leaves the place) and, once its server is signed in again, offered
from a toast: "Signed in to {server}", "{what} didn't run.", and Try again (`offerRefusedAgain`). Each step of such an
action offers the whole of it: a check-in that catches up first, refused as it reads what came in (`runRead`'s
`partOf`) or as it updates (`updateToIncoming`), offers the check-in. A caller that names nothing (a quick action:
`runAction`) is offered nothing. Never run again by itself: the user sees the workspace again before it runs.

## Known limit

Organizations come from the profiles, so an organization the user reaches only through their `*@cloud` profile, with
no profile of its own, isn't listed under their account; nor does an organization show its display name. Both need
`cm` to list an account's organizations, which it can't today.

## Considered and rejected

- **A dialog the moment a command fails** (the legacy client's way): N failing reads open N dialogs, one per server
  and per organization, stacked. The screen is one state per window, driven by one state per server.
- **A bar while the window stays usable**: every action would fail anyway, and a user could write a long comment before
  finding out.
- **A toast per failure**: N failures make N toasts, and a toast goes away while the problem stays.
- **Covering the whole app**: one server's session shouldn't stop work on another, or offline.
- **Checking sessions on a timer**: an app in the background would ask the server all day; coming back to the window is
  when it matters.
- **Running a refused operation again by itself** after signing in: the user sees the workspace first.
- **Marking a server on any failure that reads like a sign-in**, without a check: an xlink's sign-in, or a comment
  quoting `cm`'s words, would cover a healthy window.
