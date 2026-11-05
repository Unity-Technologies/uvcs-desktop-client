# Issue trackers

Jira Cloud and GitHub (github.com, its data residency hosts and Enterprise Server), connected per user on each
machine. A repository that uses a tracker shows the issues its comments name as chips, with their title and status.
Later features build on the pieces named here.

This doc lands with the code it describes, one pull request at a time: the pull request that builds a part adds that
part here, and also updates ARCHITECTURE.md "What leaves the device" and "Secrets" where it changes them. It never
reaches `main` ahead of its code.

## The principle: the link lives in the text

The app stores no link between an object and an issue. Comments and branch names already name issues
(`VCS-1009139`, `#123`, a pasted address), and every client (`cm`, the web, the Unity plugin, the official desktop
client) sees the same text. The app reads it: a reference is recognized in what is written, and the tracker only fills
in the title, status, type and assignee. With no tracker reachable, a reference is still a link.

No `cm` command and no UVCS server change: trackers are reached over HTTPS from the main process only.

## What leaves the device

A comment shown may send the issue keys it names, of the bound projects only, to the tracker the user connected for
the place's repository, and to no other host: never to a host the comment names, never for a key of a project the
binding doesn't name, never from a place with no binding. Connect sends what the user pasted and signed in with to the
tracker of that link. ARCHITECTURE.md "What leaves the device" says so; the change was flagged to the maintainers in
its pull request, and `PRIVACY.md` is theirs to update.

## Layers

As ARCHITECTURE.md "How a request flows", with HTTPS in place of `cm`:

```
shared/domain/issueTrackers.ts     Types: kinds, connections, credentials' states, bindings, issues, status categories.
shared/issueTrackers/grammars/     One pure module per tracker kind: what its links and keys look like.
shared/api/issueTrackers.ts        IssueTrackersApi, part of UvcsApi; the issueTrackersChanged event in shared/events.
main/issueTrackers/                IssueTrackerStore, TrackerSecrets, TrackerHttp, the providers.
main/services/issueTrackersService.ts   Wired in createServices.
renderer/src/components/issues/    The place's binding, issue reads (batched), the chip's card.
renderer/src/app/settings/         IssueTrackerPane.tsx, and connectFlow.ts, which decides every step of it.
```

Each tracker is two small modules that change together: its **grammar** (`shared/issueTrackers/grammars/<kind>.ts`,
pure, no network, used by both processes) and its **provider** (`main/issueTrackers/providers/<kind>.ts`, the HTTP
calls and the parsing of their JSON). A registry of each (`TRACKER_GRAMMARS`, `TRACKER_PROVIDERS`) is a
`Record<IssueTrackerKind, …>`, so a new kind doesn't compile until it has both. The kinds are `jiraCloud` and
`github`: GitHub.com, its data residency hosts and Enterprise Server share one API and differ only in where it is
(`githubApiBase`), so they are one kind.

### The grammar (shared, pure)

`TrackerGrammar` says what a tracker's text looks like, with no network:

- `recognize(url)`: a link read back as a `RecognizedLink` (kind, `server`, `project`, the issue key, and whether it
  is the issue's own page or an issue shown in another view, `issuePage` or `issueInView`), a `NotAnIssueLink` that
  says what it is instead ("a Jira board", "a GitHub repository"), or null when it isn't this tracker's.
  `recognizeTrackerLink(url)` asks every grammar, as "Ambiguous links" orders them.
- `referencesIn(text, binding)`: the issue references a comment holds for the repository's binding.
- `canonicalKey(reference, binding)`: the one form a key is cached and compared by (`VCS-12`, `acme/game#12`).
- `issueUrl(server, key)`: the issue's page, which a chip opens.
- `tokenPageUrl(server, project)`: the page where a token is made, filled in where the tracker allows it.
- `tokenShape`: what a pasted token must look like ("Sign-in").

### The provider (main)

`IssueTrackerProvider`, one per kind, each a small module:

- `signIn`: its sign-in method (`TrackerSignIn`, a union whose one member today is `{ kind: 'token' }`), a piece of
  its own, apart from what follows it.
- `whoAmI(http)`: the account the credential belongs to (`TrackerAccount`: display name, login or email, id).
- `projectAccess(http, project)`: proof that the project can be read (`ProjectAccess`: its name, its open issues and
  those assigned to the account).
- `readIssues(http, keys)`: the issues named, **one request for all of them** (`IssueRead[]`: `found`, `missing`,
  `noAccess` or `unreadable`, per key).

A provider never holds a secret: it gets a `ConnectionHttp`, the HTTP client bound to one connection, which adds the
credential itself. JSON is read by pure parsers beside each provider (`jiraIssues.ts`, `githubIssues.ts`), and errors
by `jiraErrors.ts` and `githubErrors.ts`, tested with responses shaped exactly as each tracker returns them, its errors
included.

### The HTTP client (main)

`TrackerHttp` (`main/issueTrackers/TrackerHttp.ts`) is the one way to a tracker, as `CmClient` is to `cm`.

- **Its own session**: requests go through `session.fromPartition('issue-trackers')`'s `fetch`, a session kept in
  memory and used for nothing else, with `credentials: 'omit'`: `net.fetch` alone uses the default session, whose
  cookies would go along. It keeps the system's proxy and certificates, which a company's server often needs.
- **The credential goes only where it belongs**: a request's origin must be one of the connection's
  (`connectionOrigins`: its server, and the API host its kind uses: `api.github.com`, `api.<name>.ghe.com`,
  `api.atlassian.com`); any other is refused before it's sent. Redirects are `manual`: one to another origin is an
  error (`unexpected`), never followed. A test sends a cross-origin redirect through the session's `fetch`.
- **`https:` only**. A link given as `http:` is tried once at Connect with no credential: when it redirects to the
  same host's `https:` address, Connect offers that address ("Use https://jira.example.com"); otherwise it's refused
  ("This server doesn't use a secure connection, so your token would travel readable"). GitHub Enterprise Server alone
  can be connected anyway, after the user confirms, which the connection records (`insecure`).
- JSON in and out, a timeout (`TRACKER_REQUEST_TIMEOUT_MS`), and every failure as a `TrackerError` (below). Its
  message names the host and the path, never a query string, a header or a body.
- **The command log** shows each request beside `cm`'s: `CommandLogEntry` gains `source: 'cm' | 'tracker'`, and a
  tracker's entry holds its method, host and path, without the query (`GET unity3d.atlassian.net
  /rest/api/3/issue/bulkfetch`), and its HTTP status (`httpStatus`) where a command's holds `exitCode`. A failed
  response's body is never kept as `output`: only the `TrackerError`'s message is. The command log view draws a
  tracker's entry with its host and status. Development builds warn `[tracker budget]` when the same request repeats
  more than twice in ten seconds, as `repeatedCommands.ts` does.

### Errors

`TrackerError`'s `reason` is one of `unreachable`, `signInRefused`, `noAccess`, `rateLimited` (with `until`) and
`unexpected`. A batch read answers per key where the tracker does; only an error naming no key fails the request.
Each case has its recorded fixture:

| Answer | Jira Cloud | GitHub |
| --- | --- | --- |
| `signInRefused` | 401 | 401 |
| `noAccess` | 403; 404 on a project | 403 without a rate limit; 404 on a repository |
| `rateLimited` | 429, until `Retry-After` | 200 with an error of type `RATE_LIMITED`, until `x-ratelimit-reset`; 403 or 429 with `retry-after` or `x-ratelimit-remaining: 0` (the secondary limit) |
| one key `missing` | `bulkfetch` leaves it out | its alias is null, with an error of type `NOT_FOUND` whose path ends at the issue |
| one key `noAccess` | — (Jira leaves out an issue the account can't see: `missing`) | an error of type `NOT_FOUND` whose path ends at `repository`: the token can't see that repository |
| one key `unreadable` | listed in `bulkfetch`'s `issueErrors` | its alias's other error |

A rate limit puts the origin to rest until it ends (`TrackerCooldown`): meanwhile its requests fail at once as
`rateLimited`, without being sent.

### Seams the tests replace

Every edge with the outside is passed in, never imported where it's used:

- `fetch` (the session's), into `TrackerHttp`. Tests use `fakeTrackerHttp` (`main/issueTrackers/testing/`), shaped as
  `fakeCmClient`: it answers the requests a test declares (method, address, body) with JSON recorded from each
  tracker, records what it was asked, and fails the test on any request it wasn't told about. No test touches the
  network.
- `SecretCipher` (`isAvailable`, the backend's name, `encrypt`, `decrypt`), over `safeStorage`, into `TrackerSecrets`.
- `readClipboard` and `clearClipboard`, over `clipboard`, into the sign-in.
- `now`, into `TrackerCooldown`.
- The store's file path, as `SettingsStore` takes it.

The Connect flow's decisions (which step shows, its words, which failure gets which message, what the suggestion
offers) live in `connectFlow.ts`, a pure module with its tests; `IssueTrackerPane` only maps its result to JSX. The
smoke test (`npm run e2e`) visits Settings, so it covers the section's empty state with no connection and no network.

## The data model

### Connection: a sign-in to a tracker

`TrackerConnection`: `id` (made by main), `kind`, `server` (`https://unity3d.atlassian.net`, `https://github.com`),
`scope` (below), `account` (`TrackerAccount`; for Jira Cloud its email, no secret, kept for signing in again),
`signInMethod` (`token`), `access` (what it asked for: `read`), `credential` (its state, below), `insecure` when the
user accepted `http:`, and for Jira Cloud the API base the token works with (`apiBase`: the site, or Atlassian's
gateway for a scoped token).

What one sign-in covers depends on the kind, so a connection's identity is its kind, its server and its `scope`:

| Kind | One connection per | Why |
| --- | --- | --- |
| Jira Cloud | site (`server`) | A token reaches every project the account can read on its site. |
| GitHub | server and owner (`scope`: the user or organization), or server and every owner for a classic token | A fine-grained token covers one resource owner. |

A second repository whose project a connection covers reuses it: "Use Jira at unity3d.atlassian.net · signed in as
Daniel Peñalba" binds it in one click. A GitHub repository of another organization asks for that owner's token and
makes a second connection; the first stays as it was. Signing in again to the same identity replaces its credential
only.

**GitHub's classic tokens are accepted** when pasted, as a connection for every owner on that server: some
organizations allow only classic tokens, and an Enterprise Server too old for fine-grained ones has nothing else. The
app never asks for one: "Create a token" opens the fine-grained page, as a classic token's narrowest scope that reads
private issues (`repo`) also writes. A repository is served by its owner's connection first, then by a classic one.

### Credential state

`TrackerConnection.credential` says whether reads can be made, so nothing asks a tracker with a credential it already
refused:

- `kept`: encrypted on disk, readable.
- `session`: held in memory for this session only (Linux with no keyring).
- `missing`: none to use. A `session` credential after the app restarts, a file lost, or `decryptString` throwing (the
  keychain refused it, the system's key changed).
- `refused`: the tracker answered 401 to it (expired, revoked).

The first 401 on any request sets `refused`; reads of a `missing` or `refused` connection fail at once as
`signInRefused`, with no request. Chips stay links, their card saying "Sign in to Jira again to see it". `refused` is
the session's: the next app start begins from `kept`, so its first read tries the kept credential once more. Settings
shows "Sign in again" on the connection, keeping its bindings: it first tries the kept credential with one `whoAmI`
(`retrySignIn`), and asks for a new token only if that is refused too (`signInAgainWithClipboard`). Either way, every
window reads its issues again.

### Binding: which repositories use it

`RepositoryTrackerBinding`: the repository, the `connectionId`, and its `projects` (one or more: Jira project keys
`VCS`, GitHub `owner/repo`). One tracker per repository.

A repository is identified by its spec as `cm` names it (`name@server`, `usePlaceRepository`, an organization's
server by its name: ARCHITECTURE.md "Unity organizations"), its name compared exactly and its server with
`sameServer` (`shared/links/linkSegments.ts`), so `ssl://host:8088` and `host:8088` are one. The app reads no stable
repository id for a place: `cm repository list --format={repguid}` would be one more server command for every window
opened, for a rename that seldom happens. A repository renamed in the app (`repositories.rename`) moves its binding
with it; renamed elsewhere, Settings offers the connection again in one click.

### Where they're kept

`IssueTrackerStore` (`main/issueTrackers/IssueTrackerStore.ts`) keeps connections and bindings in
`issue-trackers.json` in the user data folder, replaced whole (`replaceFileSync`), as `SettingsStore` does, but apart
from `settings.json`: the renderer writes any setting with `settings.update`, and a renderer that could change a
connection's `server` could send its token anywhere. The store changes only through `IssueTrackersApi`'s typed methods,
and a connection's server never changes: another server is another connection.

**Across windows**: every change (a sign-in, its credential's state, a binding) is sent to every window as
`issueTrackersChanged` (`shared/events`), carrying the `IssueTrackerSetup` the renderer reads (connections without
secrets, and bindings). Each window puts it in its `issueTrackers.setup` query and invalidates the issue queries of a
connection whose credential changed.

### Secrets

`TrackerSecrets` keeps each connection's credential encrypted with Electron's `safeStorage`
(`issue-tracker-secrets.json`, the encrypted bytes by connection id), read only by `TrackerHttp`, and only once a
connection exists (the smoke test and a user with none never touch the keychain). A credential never crosses IPC,
never shows in a log, an error or a toast.

- **Linux without a keyring**: `safeStorage` is unavailable or would use its plain-text backend
  (`getSelectedStorageBackend()` is `basic_text`). The credential is kept in memory for the session only (`session`),
  and Settings says so: "Kept until you quit: this computer has no keyring." It's never written in plain text.
- **macOS development builds**: the first use asks for the Keychain's "Electron Safe Storage", and a rebuilt
  development app may ask again, as its signature changes; the signed app asks once, by its own name.
- **Hidden in text**: `hideSecrets.ts` also hides the token shapes the trackers issue (`ghp_`, `github_pat_`,
  Atlassian's `ATATT`), in any text logged (`textForLog`), as a second line of defense.
- Disconnecting the last repository keeps the connection for the next one; **Sign out** removes the connection, its
  credential and its bindings.

### Issue and reference

`Issue`: `key` in its canonical form, `title`, `status` (the tracker's own words), `statusCategory`, `type` (Jira's
issue type; "Issue" or "Pull request" on GitHub), `assignee` (a `TrackerAccount` or none), `url`.

Canonical keys: a Jira key as Jira writes it (`VCS-12`, upper case); a GitHub one as `owner/repo#12`, owner and
repository lower case, as GitHub compares them. A binding's projects are compared in the same case.

`IssueStatusCategory` is the same four for every tracker, so any UI colors them alike:

| Category | Jira (`statusCategory.key`) | GitHub issue | GitHub pull request |
| --- | --- | --- | --- |
| `todo` | `new`, or none | open | — |
| `inProgress` | `indeterminate` | — | open, draft |
| `done` | `done` | closed as `COMPLETED` | merged |
| `canceled` | — | closed as `NOT_PLANNED` or `DUPLICATE` | closed unmerged |

- **Jira** has three categories and no canceled one: a "Won't Do" status is in `done`. A status without a category is
  `todo`.
- **GitHub** tells open or closed, and why closed (`stateReason`): an open issue is `todo`, its status still reading
  "Open" (the words are the tracker's; the category only colors them). `#12` may be a pull request, so issues are read
  with `issueOrPullRequest`.
- "In review" is no tracker's category.

An issue reference is `{ kind: 'issue'; key }` in `CommentReference`, `key` canonical, beside `cs:` and the others.

## How a reference is recognized

Only in a place whose repository has a binding: with none, nothing changes and no issue is read. The binding's grammar
reads the comment (`referencesIn`, joined by `findReferences(text, issueReferences)`), under the same rules as the
other references: never inside code or an image, and starting only after a space, a line's start, a bracket or an
emphasis mark. A reference the comment reads as another kind first (`br:/main/VCS-12`) stays that kind. A reference
ends where a word character (`[\p{L}\p{N}_]`) doesn't follow.

| Tracker | Written | Read as |
| --- | --- | --- |
| Jira | `VCS-1009139` | an issue of a bound project, its key upper case as Jira writes it. `ABC-123`, `UTF-8`, `ISO-8859` are no project's, so nothing |
| GitHub | `#123` | an issue of the bound repository, only when the binding has exactly one |
| GitHub | `owner/repo#123` | that repository's issue, on the same server |
| Either | an issue's own page on the bound server, as a link showing its own address | that issue |

**`#` and a number** is read only as GitHub writes it: digits only, with no leading zero, and never after a word
character, `&`, `/`, `.`, `:`, `#`, `\` or `-`, so `&#123;`, `docs/a.md#12` and `a#1` hold none. A color written as
digits (`#112233`) and "the #1 cause" are candidates, as GitHub reads them, so a bare `#N` is a chip only once read
as found (below).

**Issue addresses** are the one reference read inside a link. Markdown (GitHub's) makes a bare `https://…` a link,
and `writtenRanges` keeps every reference out of a link. So the reference comes from the link node itself, with no
second URL parser: `writtenRanges` and `isWrittenAsIs` (`lib/markdown.ts`) take the binding's reader, and a link node
whose text is its own address (a bare address, or `<https://…>`) and which `recognizeTrackerLink` reads as an issue's
own page (`issuePage`) of a bound project on the bound server becomes that issue's reference, at the node's own
offsets. Everything else stays as it was:

- `[the bug](https://…/browse/VCS-12)` stays a link: its text is the author's.
- An address that only holds a key in its query (`…/Dashboard.jspa?issue=VCS-12`, a board's `?selectedIssue=VCS-12`,
  `issueInView`) stays an address. Connect takes it as a sample; a comment doesn't take it as the issue.
- Another server's or project's issue page stays an address.

`markdown.test.ts` has a test for each, and for `(see https://x.atlassian.net/browse/VCS-12).`, whose address ends
before `)` and `.`.

### Ambiguous links

`recognizeTrackerLink` reads the address's shape first, its host second:

| Shape | Read as |
| --- | --- |
| `*.atlassian.net` or `*.jira.com`, `/browse/KEY-N` | Jira Cloud, an issue page |
| a Jira Cloud link with `?selectedIssue=KEY-N` (a board, a backlog, a search) | Jira Cloud, the issue in a view |
| `github.com/<owner>/<repo>/issues/N` or `/pull/N` | GitHub |
| `<name>.ghe.com/<owner>/<repo>/issues/N` | GitHub with data residency, its API at `api.<name>.ghe.com` |
| any other host, `/<owner>/<repo>/issues/N` | GitHub Enterprise Server. Sign-in asks its `/api/v3`; a server that doesn't answer it says "This doesn't look like GitHub Enterprise Server" |

## How references show and read

- **The chip** is the comments' own (`chipContent`'s `issue` kind, `ReferenceChip`): the tracker's icon, the key,
  and in a comment shown in full the title once read. Its card (`ChipHoverCard`) shows the title, the status in its
  category's color, the type and the assignee. A click opens the issue's page in the browser (`openReference`'s
  `issue` case: `issueUrl`, `openExternal`). Copying a part of a comment gives the reference as written (`copiedText`).
- **Without a sign-in, or when the tracker fails** (rate limited, out of reach, no access, credential refused), the
  chip is still a link to the issue's page, and its card says why there's nothing more ("Sign in to Jira to see it",
  "Jira couldn't be reached"). Nothing waits on a tracker to draw.
- **A missing issue**, by how it's written:
  - A Jira key or `owner/repo#N` is a chip as `cs:` is: one the tracker reports missing stays a chip whose card says
    "No issue VCS-12".
  - A bare `#N` starts as text and becomes a chip once read as found, and is only ever added, never taken away.
- **When it reads**, through the same doors as another repository's objects (rich-comments.md "What a chip reads"),
  which `remoteReadRules.test.ts` holds issue reads to:
  - a comment shown in full reads its issues once what it shows stayed put (`useKeySettled`);
  - a row's chip reads only while its card is open, and a bare `#N` in a row stays text, as it has no card to open;
  - the editor's chips read only while their card is open; a bare `#N` there is a chip once its issue is cached as
    found (a comment shown read it).
  Arrowing through rows reads nothing.
- **Batched**: each issue is its own query, `queryKeys.issue(connectionId, key)` with the canonical key, so a chip
  anywhere finds what another read, however it was written. Their reads go through `IssueReadBatch`, which gathers
  every key asked in the same task, splits them per connection and asks `issueTrackers.readIssues` once per
  connection, one request to the tracker for all of its keys: Jira Cloud's `POST /rest/api/3/issue/bulkfetch`, GitHub's
  GraphQL with one `issueOrPullRequest` alias per issue. At most 100 keys per request. The shared request belongs to no
  one query: cancelling one (its chip unmounted) never aborts it, and its answer fills every query that asked.
- **Cached** (`ISSUE_QUERY`): `staleTime` five minutes; `refetchOnWindowFocus: true`, so a focus reads again only the
  issues on screen and only once stale; `refetchOnReconnect: false`; `retry: false`, as `TrackerHttp` and its cooldown
  decide when to ask again. A `missing` issue is kept as long as a found one. A failure is an answer too
  (`unreadable`, `noAccess`, with when to try again), kept for `UNREADABLE_RETRY_MS`, or until the tracker's cooldown
  ends if sooner (`staleTime` read from the answer). Never on a timer.

### Every comment surface

The binding reaches the comment readers as an option, never from module state: `MarkdownOptions.issues` (an
`IssueReferenceReader` built from the binding by `issueReferenceReader`, none without one), from
`useIssueReferences()`, which reads the place's binding from the `issueTrackers.setup` query.

| Surface | What changes |
| --- | --- |
| A comment shown in full (`Markdown` with `comment`: details panels through `DetailsHeading` and `FoldedComment`, `SummaryComment`, `RevisionHeader`, `AnnotationCard`, `GraphTooltip`, the Branch Explorer's caption card) | Issue chips, read on a settled selection |
| A comment's title and line (`commentHeading()`, `commentLineInlines()` in `lib/comments/commentHeading.ts`, through `lib/comment.ts`, and their callers `CommentLine`, `RevisionHeader`, `SummaryComment`, `DetailsHeading`: every list, Incoming, the pickers, the headers' titles) | They take the reader too: compact issue chips, read while their card is open |
| The editor (`liveMarks`' chips) | Issue chips as typed, read while their card is open |
| What holds only text (`commentText`, `commentLineText`: the Branch Explorer's canvas, its tooltips, the palette, notifications) | Nothing: a reference already shows as written, so these take no reader, and `mayHoldReference`'s fast path stays as it is |

## Connecting: Settings › Issue tracker

One section, for the window's repository. A window with no repository (the home screen) lists the connections, each
with Sign out. Its steps, each one state of the same section (`connectFlow.ts`):

1. **Empty**: one sentence ("Paste a link to any issue from your tracker."), the field's placeholder shaped like an
   issue link (`https://your-company.atlassian.net/browse/PROJ-123`), and one example link shape per tracker under it.
   Nothing is filled in by itself.
2. **A suggestion**: when the branch comments the window already read hold issue addresses a grammar recognizes
   (`suggestedTrackerLinks`, over the cached branch lists, no command), "Your branch comments link to Jira", the server
   and project, how many comments ("Seen in 37 branch comments") and "Use this", which fills the field. Never filled
   in silently.
3. **Pasted**: read back in words ("Jira Cloud · unity3d.atlassian.net · project VCS") by `recognizeTrackerLink`,
   with nothing sent. A link that isn't an issue says what it is and what to paste instead. Then the next step shows.
4. **Sign in**: when a connection already covers the link ("One connection per", above), "Use Jira at
   unity3d.atlassian.net · signed in as Daniel Peñalba" binds it in one click. Otherwise the token step ("Sign-in").
   Jira Cloud asks for the account's email there too, filled in with the `cm` user when that is an email address (as on
   Unity Cloud).
5. **Proof**: "Signed in as Daniel Peñalba" and "Project VCS · 214 open issues, 6 assigned to you"
   (`projectAccess`). The pasted issue isn't shown back: it was a sample. Sign-in works but the project can't be read:
   the message names the project.
6. **Done**: the section shows the repository's tracker, projects and account, with Change (paste another link),
   Disconnect (this repository), "Add a project" by another link, and on a credential `refused` or `missing`, "Sign in
   again".

The words for each failure: "That's a link to a Jira board, not an issue. Open any issue and copy its address.",
"Jira didn't accept this token for daniel@example.com. Check the email, or create a new token.", "Jira couldn't be
reached at unity3d.atlassian.net.", "That doesn't look like a GitHub token. Copy it again from GitHub."

### What Connect asks each tracker

Only when the user goes through it, each a request:

| Tracker | Requests |
| --- | --- |
| Jira Cloud | `GET /rest/api/3/myself` on the site; on a 401, `GET /_edge/tenant_info` (the cloud id) and `myself` again through the gateway (a scoped token); `GET /rest/api/3/project/<key>`; `POST /rest/api/3/search/approximate-count` twice (open, and open assigned to the account). 4, or 6 for a scoped token |
| GitHub | One GraphQL query: the viewer, the repository's open issues (`issues(states: OPEN) { totalCount }`, which counts no pull requests, unlike REST's `open_issues_count`) and the open ones assigned to the viewer (`search(type: ISSUE, query: "repo:… is:issue is:open assignee:@me") { issueCount }`). 1 |

## Sign-in

`TrackerSignIn` is each provider's method; everything after it (the connection, `whoAmI`, the proof) is the same for
any method. Today it is a token, for both trackers.

"Create a token" opens the tracker's page in the browser, filled in where it allows it. The user copies the token
there and comes back:

- **Paste token**, a button, or ⌘V (Ctrl+V) on the sign-in step: a paste target there cancels the page's `paste`
  event without reading it (`preventDefault`, never `clipboardData`) and asks main to read the clipboard. On Linux a
  middle-click pastes the primary selection, not the clipboard: the target cancels it and does nothing.
- `signInWithClipboard(link, email?)` takes the pasted link, not a server: main runs `recognizeTrackerLink` on it
  itself, so a window can't name the server a token goes to. `signInAgainWithClipboard(connectionId, email?)` takes the
  server from the store.
- Main reads the clipboard (`readClipboard`), trims it and checks its shape for the kind (`tokenShape`): `ghp_` or
  `github_pat_` for GitHub; `ATATT`, or a classic Atlassian token's length and characters, for Jira Cloud. A text
  that isn't a token is never sent anywhere ("That doesn't look like a GitHub token").
- Signed in, main clears the clipboard if it still holds that token (`clearClipboard`), so it isn't pasted somewhere
  by mistake later.

The token never enters the renderer, so it never crosses IPC. What remains: between the copy and the paste, any app
that reads the clipboard can read the token, as with any copy and paste, and a clipboard manager keeps it in its
history whatever the app clears.

| Tracker | Token page | Access asked | Sent as |
| --- | --- | --- | --- |
| Jira Cloud | `https://id.atlassian.com/manage-profile/security/api-tokens` (nothing to fill in) | a classic token, or one scoped `read:jira-work`, `read:jira-user` | Basic, the account's email and the token. A scoped token works only through `https://api.atlassian.com/ex/jira/<cloudId>`: sign-in tries the site, then the gateway, and keeps what worked (`apiBase`) |
| GitHub | `<server>/settings/personal-access-tokens/new?name=UVCS+Desktop&target_name=<owner>&issues=read` (fine-grained, filled in; an Enterprise Server may ignore the parameters, and the page opens all the same) | Issues: read (and Metadata: read, always given) | Bearer; the API at `api.github.com`, `api.<name>.ghe.com`, or `<server>/api/v3` and `<server>/api/graphql` |

## Economy

The trackers' servers get the care `cm`'s does (CLAUDE.md "Every `cm` command earns its place"):

- One request per connection for every issue on screen (`IssueReadBatch`, the providers' batch reads); never one per
  issue.
- Read on a settled selection, a card opened, or a focus once stale; never on a timer.
- Cached five minutes, a missing issue too; a failure until it may be tried again.
- Connect's requests only when asked (the table above).
- A refused credential, or a rate limit, stops requests to that connection or origin until they can succeed; nothing
  retries in a loop and nothing blocks.

## Adding a tracker

1. Its kind in `IssueTrackerKind`.
2. Its grammar (`shared/issueTrackers/grammars/<kind>.ts`): `recognize`, `referencesIn`, `canonicalKey`, `issueUrl`,
   `tokenPageUrl`, `tokenShape`, tested with its real link shapes; its place in "Ambiguous links".
3. Its provider (`main/issueTrackers/providers/<kind>.ts`), its JSON parsers and errors beside it, tested with
   `fakeTrackerHttp` and responses recorded from the tracker, its errors included.
4. Its rows in "One connection per", the errors and status tables, "What Connect asks" and the token table; its words
   and icon (`trackerWords`, `TrackerIcon`).

The registries' `Record`s fail to compile until 2 and 3 exist.

## Considered and dropped

- **A link stored by the app** (an issue per branch in its own store, as integrations often do): every machine would
  need it and no other client would see it. The text already holds the link.
- **Recognizing any `ABC-123`**: `UTF-8`, `ISO-8859`, `SHA-256` would become issues. Only the bound projects' keys.
- **Reading `#N` with several GitHub repositories bound**: which one it names would be a guess.
- **Issue keys in any address**: a dashboard's `?issue=VCS-12` or a board's `?selectedIssue` isn't the issue's page;
  only an address showing itself, of an issue's own page, becomes a chip.
- **A second URL parser for addresses in comments**: the link node Markdown already read is the reference.
- **Telling an older GitLab's `/<group>/<project>/issues/N` from GitHub Enterprise Server**: the shapes are the same;
  such a link is read as Enterprise Server, and its sign-in says when it isn't one.
- **Connections in `settings.json`**: the renderer writes settings whole, so it could point a connection's token at
  another server. Their own store, changed only by typed methods.
- **One connection per server for every kind**: a GitHub fine-grained token covers one owner; a repository of a
  second organization would have replaced the first's token, breaking its repositories. Per kind: a Jira site, a
  GitHub server and owner.
- **One connection per repository**: the second repository on the same site would sign in again.
- **The token in a field**: the usual way, which a password manager can fill, but its text would cross IPC and live in
  the renderer's memory, for a token made a moment before. Main reads it from the clipboard.
- **A server sent by the window at sign-in**: a window taken over could send the token to its own host. Main reads the
  pasted link itself, and "Sign in again" takes the server from the store.
- **A generic `fetch` for the renderer**, or the renderer calling trackers itself: the renderer is untrusted and its
  Content-Security-Policy allows no connection out. Typed methods in main only.
- **`net.fetch` as it is**: it sends the default session's cookies. A session of its own, no credentials but the
  connection's.
- **One read per chip**: a comment with fifty keys would be fifty requests. Batched per task and connection.
- **Keying bindings by the repository's GUID**: one more server command per window for a rare rename. The spec, moved
  on the app's own renames.
- **A setup screen of parameters per tracker** (user, password, host, branch prefix, a working mode), as older
  integrations have: the link holds the setup, and the sign-in is the only thing asked.
- **One tracker per repository is the rule for now**; the binding's `projects` take several projects of that tracker.
