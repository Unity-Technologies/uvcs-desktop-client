# Issue trackers

Jira (Cloud and Data Center) and GitHub (github.com, its data residency hosts and Enterprise Server), connected per
user on each machine. A repository that uses a tracker shows the issues its comments name as chips, with their title and status.
Later features build on the pieces named here.

## The principle: the link lives in the text

The app stores no link between an object and an issue. Comments and branch names already name issues
(`VCS-1009139`, `#123`, a pasted address), and every client (`cm`, the web, the Unity plugin, the official desktop
client) sees the same text. The app reads it: a reference is recognized in what is written, and the tracker only fills
in the title, status, type and assignee. With no tracker reachable, a reference is still a link.

No `cm` command and no UVCS server change: trackers are reached over HTTPS from the main process only.

## What leaves the device

A comment shown may send the issues it names to the tracker the user connected for the place's repository, and to no
other host: never to a host the comment names, never from a place with no binding. Those are a Jira binding's project
keys, and on GitHub the repositories of the connected server (`#12` of the bound repository, `owner/repo#12` of any).
Connect sends what the user pasted and signed in with to the tracker of that link. ARCHITECTURE.md "What leaves the
device" lists it; `PRIVACY.md` is the maintainers' to update, never a change's.

## Layers

As ARCHITECTURE.md "How a request flows", with HTTPS in place of `cm`:

```
shared/domain/issueTrackers.ts     Types: kinds, connections, credentials' states, bindings, issues, status categories.
shared/issueTrackers/              Pure, both processes: each tracker's grammar (grammars/), recognizeTrackerLink,
                                   the readers comments use (issueReferences.ts), connections (connections.ts), which
                                   sign-in methods a server offers (signInMethods.ts).
shared/api/issueTrackers.ts        IssueTrackersApi, part of UvcsApi; the issueTrackersChanged event in shared/events.
main/issueTrackers/                IssueTrackers (the engine), IssueTrackerStore, TrackerSecrets, TrackerHttp, the
                                   providers (providers/), the device flow (signIn/), createIssueTrackers (the wiring).
main/services/issueTrackersService.ts   Wired in createServices.
renderer/src/components/issues/    The place's tracker (usePlaceTracker), issue reads (issueQueries, IssueReadBatch),
                                   the chip (IssueChip, issueChipShape), a comment's reads (ResolvedIssues).
renderer/src/app/settings/issueTrackers/   Settings › Issue tracker, and connectFlow.ts, which decides every step of it.
```

Each tracker is two small modules that change together: its **grammar** (`shared/issueTrackers/grammars/<kind>.ts`,
pure, no network) and its **provider** (`main/issueTrackers/providers/<kind>.ts`, the HTTP calls and the parsing of
their JSON). A registry of each (`TRACKER_GRAMMARS`, `TRACKER_PROVIDERS`) is a `Record<IssueTrackerKind, …>`, so a new
kind doesn't compile until it has both. The kinds are `jiraCloud`, `jiraDataCenter` and `github`. GitHub.com, its data
residency hosts and Enterprise Server share one API and differ only in where it is (`githubApiBase`,
`githubGraphqlUrl`), so they are one kind. Jira Cloud and Data Center are two: another sign-in (an email and an API
token as Basic, against a personal access token as Bearer), another REST API version (v3, against v2) and other
endpoints for the same read (`issue/bulkfetch`, against one search); their keys and references are one module's
(`jiraKeys`).

### The grammar (shared, pure)

`TrackerGrammar` says what a tracker's text looks like, with no network:

- `recognize(url)`: a link read back as a `RecognizedLink` (kind, `server`, `project`, the canonical issue key, and
  whether it is the issue's own page or an issue shown in another view, `issuePage` or `issueInView`), a
  `NotAnIssueLink` that says what it is instead ("a Jira board", "a GitHub repository"), or null when it isn't this
  tracker's. `recognizeTrackerLink(text)` asks every grammar, as "Ambiguous links" orders them.
- `referencesReader(projects)`: what reads the issue references a text holds for the bound projects, its pattern
  built once per binding.
- `issueUrl(server, key)`: the issue's page, which a chip opens.
- `tokenPageUrl(server)`: the page where a token is made, filled in where the tracker allows it.
- `tokenShape(token)`: `known` (a shape the tracker issues: `ghp_`, `github_pat_`, `gho_`; Atlassian's `ATATT`),
  `plausible` (length and characters only) or `none`.

`issueReferenceReader(binding, connection)` turns a grammar and a binding into the `IssueReferenceReader` comments read
with: its `referencesIn(text)`, `issueAtAddress(address)` (the issue an address of the bound server is the page of) and
`issueUrl(key)`.

### The provider (main)

`IssueTrackerProvider`, one per kind:

- `origins(server)`: where the connection's credential may go: its server and its API's host.
- `authorization(credential)`: the `Authorization` header (Jira Cloud: Basic, the email and the token; GitHub:
  Bearer).
- `signIn(http, server)`: who the credential signs in as (`SignedIn`: the `TrackerAccount`, and for Jira Cloud the API
  base its token works with).
- `whoAmI(http, connection)`, `projectAccess(http, connection, project)`: the account, and proof that a project can
  be read (`ProjectAccess`: its name, open issues and those assigned to the account).
- `readIssues(http, connection, keys)`: the issues named, **one request for all of them** (at most
  `MAX_KEYS_PER_READ`, 100), each key's `IssueRead`: `found`, `missing`, `noAccess` or `unreadable`.

A provider never holds a secret: it gets a `ConnectionHttp`, the HTTP client bound to one connection, which adds the
credential itself. JSON is read by pure parsers beside each provider (`jiraIssues.ts`, `githubIssues.ts`), tested
with responses shaped exactly as each tracker returns them, its errors included. Later capabilities are new methods,
built for every tracker with their fixtures; nothing is stubbed before.

### The HTTP client (main)

`TrackerHttp` (`main/issueTrackers/TrackerHttp.ts`) is the one way to a tracker, as `CmClient` is to `cm`.

- **Its own session**: requests go through `session.fromPartition('issue-trackers')`'s `fetch` (`createIssueTrackers`),
  a session kept in memory and used for nothing else, with `credentials: 'omit'`: `net.fetch` alone uses the default
  session, whose cookies would go along. It keeps the system's proxy and certificates.
- **The credential goes only where it belongs**: a request's origin must be one of the connection's (`bound(origins,
  …)`: its server, and `api.github.com`, `api.<name>.ghe.com` or `api.atlassian.com`); any other, and any `http:`
  address, is refused before it's sent. Redirects are `manual`: one is an error naming where it led by its host
  only, never followed.
- **`https:` only**: a link given as `http:` is refused at Connect ("This server doesn't use a secure connection, so
  your token would travel readable").
- JSON in and out, a timeout (`TRACKER_REQUEST_TIMEOUT_MS`), and every failure as a `TrackerError` (below), whose
  message names the host and the path, never a query string, a header or a body.
- **The command log** shows each request beside `cm`'s (`trackerLogEntry`, `CmClient.logEntry`, numbered with them):
  `CommandLogEntry.source` is `tracker`, its line the method, host and path without the query (`POST
  acme.atlassian.net/rest/api/3/issue/bulkfetch`), its `httpStatus` the answer's. A failure keeps the
  `TrackerError`'s words as `output`; a failed answer adds the tracker's own error words (Jira's `errorMessages` and
  `errors`, GitHub's `message`, at most 300 characters: `failedAnswerWords`), so a request the app got wrong (a 400)
  says why there, never to the user; the log words its ending "HTTP 404", or "No answer" (`entryEnding`). A window's log gets the requests its own calls made (`ranInPlace`).

### Errors

`TrackerError`'s `reason` is one of `unreachable`, `signInRefused`, `noAccess`, `rateLimited` (with `until`) and
`unexpected`. A batch read answers per key where the tracker does; only an error naming no key fails the request.
Each case has its recorded fixture:

| Answer | Jira Cloud | Jira Data Center | GitHub |
| --- | --- | --- | --- |
| `signInRefused` | 401 | 401; a 302 to its login page (`samlsso`, `login.jsp`: an SSO server refusing a token, `toLogin`) | 401 |
| `noAccess` | 403; 404 on a project | 403; 404 on a project | 403 without a rate limit; a repository that answers null |
| `rateLimited` | 429, until `Retry-After` | 429, until `Retry-After` | 200 with an error of type `RATE_LIMITED`, until `x-ratelimit-reset`; 403 or 429 with `retry-after` or `x-ratelimit-remaining: 0` (the secondary limit) |
| one key `missing` | `bulkfetch` leaves it out | the search leaves it out (`validateQuery=false`: Data Center's is a boolean, Cloud's `warn` is a 400 there, and its default, true, fails the whole search on one key that doesn't exist) | its alias is null, with an error of type `NOT_FOUND` at the issue |
| one key `noAccess` | — (Jira leaves out an issue the account can't see: `missing`) | — (likewise `missing`) | an error of type `NOT_FOUND` whose path ends at the repository: the token can't see it |
| one key `unreadable` | the keys left out when `bulkfetch` lists `issueErrors` (which name issues by id only) | — | its alias's other error |

A rate limit puts the origin to rest until it ends (`TrackerCooldown`): meanwhile its requests fail at once as
`rateLimited`, without being sent; GitHub's GraphQL `RATE_LIMITED` rests it too (`restOrigin`).

### Seams the tests replace

Every edge with the outside is passed in, never imported where it's used:

- `fetch`, into `TrackerHttp`. Tests use `fakeTrackerHttp` (`main/issueTrackers/testing/`), shaped as
  `fakeCmClient`: a real `TrackerHttp` whose fetch answers the requests a test declares (method and address) with JSON
  recorded from each tracker, in turn when given several, records what it was asked, and fails the test on any
  request it wasn't told about. No test touches the network.
- `SecretCipher` (`canKeep`, `encrypt`, `decrypt`), over `safeStorage` (`safeStorageCipher`), into `TrackerSecrets`.
- `newId`, `now`, `wait` (the device flow's pause), `openExternal` and `askHostConsent` (main's dialog), into
  `IssueTrackers`.
- The files' paths, as `SettingsStore` takes its own.

A development build reads two variables (`createIssueTrackers`; a packaged app reads neither):
`UVCS_GITHUB_OAUTH_CLIENT_ID`, an OAuth app of the developer's own for GitHub's device flow, and `UVCS_FAKE_TRACKERS`,
a module whose `fetch` answers as the trackers do (`scripts/e2e/fakeTrackers.cjs`), to see every flow with no account
and no network.

The Connect flow's decisions (which step shows, its words, which failure gets which message, what the suggestion
offers) live in `connectFlow.ts`, a pure module with its tests; the components only map its results to JSX. The
smoke test (`npm run e2e`) visits Settings › Issue tracker, its empty state.

## The data model

### Connection: a sign-in to a tracker

`TrackerConnection`: `id` (made by main), `kind`, `server` (`https://unity3d.atlassian.net`, `https://github.com`),
`scope` (below), `account` (`TrackerAccount`; for Jira Cloud its email, no secret, kept to sign in again),
`signInMethod` (how it signed in: `deviceCode` or `token`), `access` (what it asked for: reading), `credential` (its
state, below), and for Jira Cloud the API base the token works with (`apiBase`: the site, or Atlassian's gateway).

What one sign-in covers depends on the kind, so a connection's identity is its kind, its server and its `scope`:

| Kind | One connection per | Why |
| --- | --- | --- |
| Jira Cloud | site (`server`) | A token reaches every project the account can read on its site. |
| Jira Data Center | server (its context path included) | A personal access token reaches what its account can read there. |
| GitHub | server, for a token of every owner (`scope` `*`: the device flow's, a classic token); server and owner for a fine-grained token (`scope`: the owner, lower case) | A fine-grained token covers one resource owner. |

A second repository whose project a connection covers reuses it (`coveringConnection`: the owner's first, then one of
every owner): "Use Jira at unity3d.atlassian.net · signed in as Daniel Peñalba" binds it in one click. A fine-grained
GitHub token for another organization makes a second connection; the first stays as it was. Signing in again to the
same identity replaces its credential only.

### Credential state

`TrackerConnection.credential` says whether reads can be made, so nothing asks a tracker with a credential it already
refused:

- `kept`: encrypted on disk, readable.
- `session`: held in memory for this session only (Linux with no keyring).
- `missing`: none to use. A `session` credential after the app restarts, a file lost, or the keychain refusing to
  decrypt it.
- `refused`: the tracker answered 401 to it (expired, revoked).

The first 401 on any request sets `refused`; reads of a `missing` or `refused` connection then fail at once as
`signInRefused`, with no request, and chips stay links, their card saying "Sign in to Jira again to see it".
`refused` is the session's: the next app start begins from `kept`, so its first read tries the kept credential once
more. Settings shows "Sign in again" on the connection, keeping its bindings: it first tries the kept credential with
one `whoAmI` (`retrySignIn`). Only a credential the tracker refused asks for a new one, by the server's best method
(`signInAgainStep`: GitHub's device flow where it can, `startDeviceSignIn({ connectionId })`, else a token,
`signInAgain`); out of reach or rate limited, the credential stays and the section says why, with "Try again". Either
way, every window reads its issues again (`connectionsToReread`).

### Binding: which repositories use it

`RepositoryTrackerBinding`: the repository, the `connectionId`, and its `projects` (Jira project keys `VCS`, GitHub
`owner/repo` in lower case). One tracker per repository; "Add a project" adds another of the same tracker.

A repository is identified by its spec as `cm` names it (`name@server`, an organization's server by its name:
ARCHITECTURE.md "Unity organizations"), its name compared exactly and its server as links compare servers
(`sameRepository`, `sameServer`). The app reads no stable repository id for a place: `cm repository list
--format={repguid}` would be one more server command for every window opened, for a rename that seldom happens. A
repository renamed in the app (`repositories.rename`) moves its binding with it (`IssueTrackers.repositoryRenamed`);
renamed elsewhere, Settings offers the connection again in one click.

### Where they're kept

`IssueTrackerStore` keeps connections and bindings in `issue-trackers.json` in the user data folder, replaced whole
(`replaceFileSync`), apart from `settings.json`: the renderer writes any setting with `settings.update`, and a
renderer that could change a connection's `server` could send its token anywhere. The store changes only through
`IssueTrackersApi`'s typed methods, and a connection's server never changes: another server is another connection.

**Across windows**: every change (a sign-in, a credential's state, a binding) goes to every window as
`issueTrackersChanged`, carrying the `IssueTrackerSetup` (connections without secrets, bindings, whether credentials
last only the session, the hosts the device flow serves). Each window puts it in its setup query
(`useIssueTrackersFromMain`) and reads again the issues of a connection whose sign-in changed.

### Secrets

`TrackerSecrets` keeps each connection's credential encrypted with Electron's `safeStorage`
(`issue-tracker-secrets.json`, the encrypted bytes by connection id), read only by `IssueTrackers` to build a
connection's `ConnectionHttp`, and only once a connection exists: a user with none never touches the keychain. A
credential never goes back to a window, and never shows in a log, an error or a toast.

- **No encryption to keep it with**: wherever `safeStorage` isn't available, and on Linux without a keyring, where it
  would use its plain-text backend (`getSelectedStorageBackend()` is `basic_text`), the credential is kept in memory
  for the session only (`session`), and Settings says so: "Kept until you quit: this computer has no keyring." It's
  never written in plain text.
- **macOS development builds**: the first use asks for the Keychain's "Electron Safe Storage", and a rebuilt
  development app may ask again, as its signature changes; the signed app asks once, by its own name.
- **Hidden in text**: `hideSecrets.ts` hides the trackers' token shapes (`TRACKER_TOKENS`) in any text logged, as a
  second line of defense.
- Disconnecting a repository keeps the connection for the next one; **Sign out** (Settings in a window with no
  repository) removes the connection, its credential and its bindings.

### Issue and reference

`Issue`: `key` in its canonical form, `title`, `status` (the tracker's own words), `statusCategory`, `type` (Jira's
issue type; "Issue" or "Pull request" on GitHub), `assignee`, `url`.

Canonical keys: a Jira key as Jira writes it (`VCS-12`); a GitHub one as `owner/repo#12`, owner and repository lower
case, as GitHub compares them (`githubKey`).

`IssueStatusCategory` is the same four for every tracker, so any UI colors them alike (a dot on the chip, the
`--issue-*` tokens):

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

An issue reference is `{ kind: 'issue'; key; bare }` in `CommentReference`, `key` canonical, `bare` for GitHub's `#12`.

## How a reference is recognized

Only in a place whose repository has a binding: with none, nothing changes and no issue is read. The binding's reader
joins `findReferences(text, issues)`, under the same rules as the other references: never inside code or an image,
starting only after a space, a line's start, a bracket or an emphasis mark, and ending where no letter or digit
follows (`REFERENCE_START`, `REFERENCE_END`). A reference the comment reads as another kind first (`br:/main/VCS-12`)
stays that kind.

| Tracker | Written | Read as |
| --- | --- | --- |
| Jira | `VCS-1009139` | an issue of a bound project. `ABC-123`, `UTF-8`, `ISO-8859` are no project's, so nothing |
| GitHub | `#123` | an issue of the bound repository, only when the binding has exactly one |
| GitHub | `owner/repo#123` | that repository's issue, on the same server; a name with a dot isn't read (`docs/a.md#12` is a file's heading), its issue's address is |
| Either | an issue's own page, as a link showing its own address | that issue: of a bound project on Jira, of any repository of the server on GitHub |

**`#` and a number** is read only as GitHub writes it: digits only, with no leading zero, and never after a letter or
a digit, `&`, `/`, `.`, `:`, `#`, `\` or `-`, so `&#123;`, `docs/a.md#12` and `a#1` hold none. A color written as
digits (`#112233`) and "the #1 cause" are candidates, as GitHub reads them, so a bare `#N` is a chip only once read
as found (below).

**Issue addresses** are the one reference read inside a link. Markdown (GitHub's) makes a bare `https://…` a link,
and `writtenRanges` keeps every reference out of a link, so the reference comes from the link node itself, with no
second URL parser: `writtenRanges` takes the binding's reader, and a link node whose text is its own address (bare, or
`<https://…>`) and which `issueAtAddress` reads as an issue's own page becomes that issue's reference, at the node's
own offsets (`issueAddressOf`). A link with its own text (`[the bug](…)`), an address that only holds a key in its
query (`?selectedIssue=VCS-12`, `issueInView`), and another server's page stay as they were (`markdownIssues.test.ts`).
The chip shows its key; copying gives back the address.

### Ambiguous links

`recognizeTrackerLink` reads the address's shape first, its host second:

| Shape | Read as |
| --- | --- |
| `*.atlassian.net` or `*.jira.com`, `/browse/KEY-N` | Jira Cloud, an issue page |
| a Jira Cloud link with `?selectedIssue=KEY-N` (a board, a backlog, a search) | Jira Cloud, the issue in a view |
| any other host, `<base>/browse/KEY-N` | Jira Data Center, the server `<base>`, its context path kept (`https://tools.acme.com/jira`). Its other pages look like any web page, so only an issue's is read. A key is never `issues` and `browse` holds no number, so this never meets GitHub Enterprise Server's shape |
| `github.com/<owner>/<repo>/issues/N` or `/pull/N` | GitHub |
| `<name>.ghe.com/<owner>/<repo>/issues/N` | GitHub with data residency, its API at `api.<name>.ghe.com` |
| any other host, `/<owner>/<repo>/issues/N` | GitHub Enterprise Server. Sign-in asks its `/api/v3`; a server that doesn't answer it says "This doesn't look like GitHub Enterprise Server" (`NotThisTrackerError`) |

## How references show and read

- **The chip** (`IssueChip`, through `ReferenceChip` for `chipContent`'s `issue`): its status's dot (or the issue
  icon until read), the key, and in a comment shown in full the title once read (`issueChipShape`). Its card
  (`ChipHoverCard`, `issueCard`) shows the title, then the status, type and assignee. A click opens the issue's page in
  the browser. Copying a part of a comment gives the reference as written.
- **Without a sign-in, or when the tracker fails** (rate limited, out of reach, no access, credential refused), the
  chip is still a link to the issue's page, and its card says why there's nothing more; a tracker that refuses the
  read itself (a 403 to the whole batch) says "Your Jira token can't read issues" ("sign-in" for GitHub). Nothing
  waits on a tracker to draw.
- **A missing issue**, by how it's written: a Jira key or `owner/repo#N` stays a chip whose card says "No issue
  VCS-12", as `cs:` does; a bare `#N` starts as text and becomes a chip once read as found, never taken away, and in a
  row stays text, as it has no card to open.
- **When it reads**, through the same doors as another repository's objects (rich-comments.md "What a chip reads"),
  which `remoteReadRules.test.ts` holds issue reads to: a comment shown in full reads its issues once what it shows
  stayed put (`ResolvedIssues`, `useKeySettled`, up to `MAX_ISSUES_PER_COMMENT`); a row's chip, a title's, and the
  editor's read only while their card is open. Arrowing through rows reads nothing.
- **Batched**: each issue is its own query (`issueQuery`, keyed `issueKeys.issue(connectionId, key)`), so a chip
  anywhere finds what another read. Their reads go through `IssueReadBatch`, which gathers every key asked in the same
  task, splits them per connection and asks `issueTrackers.readIssues` once per connection: Jira Cloud's `POST
  /rest/api/3/issue/bulkfetch`, Jira Data Center's `GET /rest/api/2/search` (`key in (…)`; a read-only token allows only GET, and an address past
  `MAX_SEARCH_URL_LENGTH`, 6,000 characters, splits into more searches: `searchUrls`), GitHub's GraphQL with one `issueOrPullRequest` alias per issue, the repositories as
  variables. The shared request belongs to no one query: cancelling one never aborts it.
- **Cached**: `staleTime` five minutes (`ISSUE_FRESH_MS`), a missing issue too; `refetchOnWindowFocus`, so a focus
  reads again only the issues on screen and only once stale; no reconnect read and no retry, as `TrackerHttp` and its
  cooldown decide when to ask again. A failure is an answer (`unreadable`, with when to try again), fresh for
  `UNREADABLE_RETRY_MS`, or until the tracker's rate limit ends if sooner (`issueStaleTime`). Never on a timer.

### Every comment surface

The binding reaches the comment readers as an option, never from module state: `MarkdownOptions.issues`, from
`useIssueReferences()`, which reads the place's binding (`usePlaceTracker`, `placeTrackerOf`).

| Surface | What changes |
| --- | --- |
| A comment shown in full (`Markdown` with `comment`: details panels, `SummaryComment`, `RevisionHeader`, the annotate card, the Branch Explorer's caption card and tooltip) | Issue chips, read on a settled selection (`ResolvedIssues`) |
| A comment's line (`CommentLine`, through `commentLineInlines(comment, issues)`: every list, Incoming, the pickers, the headers' titles) | Compact issue chips, read while their card is open |
| The editor (`liveMarks`' chips, the `issueReferences` facet, reconfigured as the place's tracker changes) | Issue chips as typed, read while their card is open |
| What holds only text (`commentText`, `commentLineText`: the Branch Explorer's canvas, the palette, notifications) | Nothing: a reference already shows as written, so these take no reader, and `mayHoldReference`'s fast path stays as it is |

## Suggesting issues: `#` in the editor

`#` is the comment editor's own trigger (`SUGGESTION_TRIGGERS`, beside `:`; the palette doesn't read it), on only
where the place's repository has a tracker: `suggestionQueryAt` asks the `issueReferences` facet, so without one `#`
is plain text, with no list and no hint (`focusModeHints({ issues })`).

- **Not a heading**: a space after `#` (`# Title`) ends the word before it starts, and `##` holds a `#`
  (`ISSUE_TEXT`: letters, digits, `_` and `-` only), so a heading opens nothing; nor does a `#` inside a word (`C#`,
  `acme/game#1`).
- **What it lists** (`issueSuggestionRows`, its reads decided by `issueSuggestionReads`):
  - On opening, the account's issues not done in the bound projects, most recently updated first: one search
    (`searchIssues` with no words), kept a minute (`ISSUE_SEARCH_FRESH_MS`).
  - Typing narrows that list locally, by key, number or title words (`rankCandidates`).
  - A key or a number that names one issue (`keyTyped`: `VCS-12`, `vcs-12`, or `12` with one project bound) is read by
    key once typing settles, through the batched reads (`issueQuery`), never searched.
  - Words are searched on the tracker once typing settles (`SERVER_SEARCH_DELAY_MS`) and from three characters
    (`ISSUE_WORDS_MIN_LENGTH`), cached per words (`issueSearchQuery`). The issue a key names comes first, then the
    local matches, then the search's, each once, the best `SUGGESTION_LIMIT`.
  - Each row: the status's dot, the reference as it will be written, the title.
- **A pick** writes the reference as the place's comments read it back (`referenceText`): a Jira key, `#12` for the
  one GitHub repository bound, `owner/repo#12` otherwise. The issue read comes with it (`picked` seeds
  `issueKeys.issue`), so its chip shows its title and status at once.
- **When it can't**, one quiet row, never picked (Enter stays a line end, typing goes on as text): "Reading issues…",
  "No open issues assigned to you", "No issues match “x”", "No issue VCS-99", "Couldn't search Jira", and for a
  sign-in that needs renewing "Sign in to Jira again in Settings", which asks nothing.
- **The searches** (`IssueTrackers.searchIssues`, `IssueSearch`): one request each, at most `ISSUE_SEARCH_LIMIT` (20)
  issues, the user's words only ever inside quotes:
  - Jira Cloud: `POST /rest/api/3/search/jql`; Jira Data Center: `GET /rest/api/2/search` with `validateQuery=false`.
    Both take `jiraSearchJql`: `project in (…)`, then `summary ~ "…"` with the words (`jiraTitleWords`: Lucene's
    reserved characters, quotes and backslashes dropped, lower case so `AND`, `OR` and `NOT` are words, the last word
    a prefix), or `assignee = currentUser() AND statusCategory != Done`; `ORDER BY updated DESC`.
  - GitHub: GraphQL's `search` (`GITHUB_SEARCH`), the query as a variable (`githubSearchQuery`: `repo:` per
    repository, `is:issue`, `sort:updated-desc`, then `in:title` and each word quoted, its quotes dropped, or
    `is:open assignee:@me`). It counts against GitHub's search limit, hence the settling and the three characters.
- **A newer search replaces the one running**: per window and repository (`SupersededSearches`), the older request is
  aborted where it is (`TrackerRequest.signal`) and answers `superseded`, which the list reads as still reading and
  never keeps (`issueSearchStaleTime`).

## Connecting: Settings › Issue tracker

One section (`IssueTrackerPane`), for the window's repository. Each state is one card (`styles.card`): a tinted header
saying what it is and where the user stands, its sections parted by hairlines, one obvious next action. Status reads
in its own tokens (`--positive-*`, `--caution-*`, `--danger-*`), never a raw color. What each card shows is decided in
pure modules (`connectFlow`, `trackerCardContent`); the components only draw it.

**Connect** (`ConnectTracker`), its header the title and its steps, Link · Sign in · Connected (`ConnectSteps`,
`connectSteps`); changing a tracker already connected adds Back.

1. **Empty**: a mark, "See your issues where comments name them", one line, the field (its placeholder shaped like an
   issue link) and the link shapes per tracker under it (`LINK_EXAMPLES`). Nothing is filled in by itself.
2. **A suggestion**: when the branch comments the window already read hold issue addresses a grammar recognizes
   (`suggestedTrackerLink`, over the cached branch lists, no command), "Your branch comments link to Jira", the server
   and project, how many comments, and "Use this", which fills the field. Never filled in silently.
3. **Pasted**: read back with nothing sent, checked: the tracker's kind as a badge, then the host and the project
   bold (`linkReadBack`'s `parts`; its `words` for screen readers). A link that isn't an issue says what it is and
   what to paste instead.
4. **Next: sign in** (`signInStepFor`): when a connection already covers the link, "Next: use your Jira sign-in" and
   "Use it". Otherwise the tracker's best sign-in method ("Sign-in"). In the token step one button leads
   (`tokenStepLead`): "Create a token" until a token is in the field, then "Sign in". A failure is said under it,
   scrolled into view.

**Connected** (`TrackerCard`): the header holds the tracker's mark (`TrackerIcon`: neutral glyphs, no brand's), its
name, kind and host, how it stands (`StatusPill`, `trackerStatus`) and a ⋯ menu: "Use another tracker…" and
"Disconnect…", which asks first (`disconnectQuestion`). Then:

- **The moment of success**, right after connecting: a green callout, "Connected to Jira", and the proof, checked,
  its values bold ("Signed in as **Daniel Peñalba**", "Project **VCS** · 214 open issues, 6 assigned to you",
  `proofLines`). The pasted issue isn't shown back: it was a sample. It rises in once (none with reduced motion) and
  settles after `SUCCESS_SHOWN_MS`. Sign-in works but the project can't be read: the message names the project, and
  nothing is bound.
- **Needs signing in** (a credential `refused` or `missing`): an amber pill and a callout saying why, that issues
  show as plain links until then, and "Sign in again" (`SignInAgain`).
- **Can't reach Jira** (every project out of reach): a red pill and a callout saying where (`unreachableWords`), with
  Try again.
- **Account**: the account's initials, name, and email or login (`accountLines`).
- **Projects**: one line on what they're for, with a reference as written ("Keys like VCS-123 in this repository's
  comments show as chips…", `projectsExplained`); a row each, its key in mono, its name and counts once read
  (`projectRows`, from `readProjects`: each project's `projectAccess`, read as the card shows and kept five minutes,
  keyed by the connection, its credential's state and the projects: `useBoundProjects`), removable on hover or focus
  while another stays (`removeProject`); "+ Add a project" opens a row of its own: a full-width field for a link to
  an issue of the other project, read back as pasted, with Add and Cancel.

In a window with no repository, the sign-ins this computer keeps: a row each with its mark, name, account and pill,
and Sign out on hover or focus (`signInRows`).

Each failure gets one plain sentence (`connectFailureWords`), and one a new token would fix gets "Create a new token".

### What Connect asks each tracker

Only when the user goes through it:

| Tracker | Requests |
| --- | --- |
| Jira Cloud | `GET /rest/api/3/myself` on the site; on a 401, `GET /_edge/tenant_info` (the cloud id) and `myself` again through the gateway (a scoped token); `GET /rest/api/3/project/<key>`; `POST /rest/api/3/search/approximate-count` twice (open, and open assigned to the account). 4, or 6 for a scoped token |
| Jira Data Center | `GET /rest/api/2/myself`, `GET /rest/api/2/project/<key>`, `GET /rest/api/2/search` with `maxResults=0` twice (its `total`: open, and open assigned to the account). 4 |
| GitHub | `GET /user`, then one GraphQL query: the repository's open issues (`issues(states: OPEN) { totalCount }`, which counts no pull requests, unlike REST's `open_issues_count`) and the open ones assigned to the viewer (`search(type: ISSUE, …) { issueCount }`). 2, plus the device flow's own |

The project's own read proves the sign-in. Jira's two counts only decorate it ("214 open"): each has `COUNT_TIMEOUT_MS`,
and one that doesn't answer in time, is out of reach, rate limited or refused by the server is left out, never failing
the proof (`countAnswer`). Only a refused sign-in fails it. On a large Data Center, a count can take longer than a
request's whole budget.

## Sign-in

Each tracker's server offers its methods best first (`signInMethodsFor`): `deviceCode` (OAuth's device flow, RFC
8628), `browser` (an OAuth redirect, a slot none fills yet) and `token`. Everything after a method (the connection,
the proof, the binding) is the same for any. A new method for a tracker is one more case there and its step in
Settings.

| Server | Methods |
| --- | --- |
| github.com | The device flow, where the app ships an OAuth App's client id (`GITHUB_OAUTH_CLIENT_IDS`); a token otherwise |
| `<name>.ghe.com`, Enterprise Server | A token: the device flow needs an app registered on that server |
| Jira Cloud | An API token and the account's email: Atlassian's OAuth needs a client secret, which a desktop app can't keep |
| Jira Data Center | A token sent as Bearer, no email: Jira's own personal access token, or one an app makes where the server turns those off (resolution's API Token Authentication, whose tokens may be read-only: every request is a GET). Browser sign-in would need an application link each site's admin sets up: its `browser` slot stays empty |

### The device flow

"Sign in with GitHub" asks for a code (`requestDeviceCode`: `POST /login/device/code`, the client id and the `repo`
scope, `GITHUB_OAUTH_SCOPES`, as GitHub has no narrower scope that reads a private repository's issues), shows it,
copies it and opens `github.com/login/device`, where the user pastes it and approves. Main polls the token endpoint at
the server's pace (`pollForToken`, `nextDevicePoll`: `authorization_pending` waits the interval, `slow_down` five
seconds more, `access_denied` and `expired_token` end it), then signs in as with a token. No client secret is needed,
so none ships. "Use a token instead" is a quiet link beside the button.

A flow lives as long as the window that started it waits for it:

- Its outcome waits until the window takes it (`finishDeviceSignIn`), even when it ended first.
- Leaving the step cancels it (`cancelDeviceSignIn`); a flow that started after its step unmounted (Settings closed
  while the code was asked for) is cancelled as it starts.
- Closing the window, or reloading it (a main frame's navigation to another document), ends its flows
  (`windowClosed`, watched once per window in `issueTrackersService`), and they're forgotten once ended.

### The token

A masked field paste works in, as people know it:

- **"Create a token"** opens the tracker's page (`openTokenPage`), filled in where it allows: GitHub's
  `<server>/settings/tokens/new?scopes=repo&description=UVCS%20Desktop`, Atlassian's
  `https://id.atlassian.com/manage-profile/security/api-tokens`. A Jira Data Center has two
  (`JIRA_DATA_CENTER_TOKEN_PAGES`, `TokenPages`): main first asks, with no credential (so no host consent) but through
  `TrackerHttp` and the command log, `GET <server>/plugins/servlet/de.resolution.apitokenauth/admin`, once per server
  while the app runs. A 401 or a 200 means the API Token Authentication app is there, and its page opens; a redirect
  to the login page (what a server answers a servlet it doesn't have), any other answer or none opens Jira's own,
  `<server>/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`
  (`dataCenterTokenPage`). "Other token page", a quiet button beside it (`otherTokenPageOffered`), opens the other
  one, so a wrong guess never strands anyone.
- **Pasting** a token of a known shape (`submitsOnPaste`) signs in at once; Enter or "Sign in" otherwise. A text of no
  token's shape is never sent ("That doesn't look like a GitHub token").
- The app never reads the clipboard by itself: only a paste the user makes reaches the field. A token pasted and
  signed in with is cleared from the clipboard (written, never read).
- The token goes to main once, on submit, and never back; the field forgets it.
- Jira Cloud asks for the account's email, filled in with the `cm` user when that is an address (`suggestedEmail`).
- A Jira Data Center token ("Jira token": Jira's own or the app's) has no fixed prefix (Jira's are about 44 base64
  characters): it is only plausible, so a paste fills the field and "Sign in" signs in.
- A server that sends the sign-in to its login page (single sign-on refusing the token) says so: "Jira sent this
  sign-in to its login page at jira.acme.com. Check the token, or create a new one." (`sentToLogin`).

A GitHub fine-grained token (`github_pat_`) is accepted too, as a connection for its owner.

### Host consent

Any address shaped like an issue on another host (`https://<host>/<owner>/<repo>/issues/1`,
`https://<host>/browse/KEY-1`) reads as GitHub Enterprise Server or Jira Data Center, so a window, untrusted, could name
a host of its choosing. Before a credential first goes to a host
that is none of the trackers' own (github.com, `*.ghe.com`, `*.atlassian.net`, `*.jira.com`) nor a connection's server
(`needsHostConsent`, built on the grammars' own host rules), main asks the user in its own dialog over the window:
"Sign in to git.acme.com?", the host shown as the address names it, port and punycode kept, Sign In or Cancel, Cancel
the default, and what the server is meant to be ("Sign in only if it's your company's Jira", or its GitHub Enterprise
Server) (`askHostConsent`, `hostConsentQuestion`). A window can't answer it; Cancel, Escape and closing it decline.
Sign-ins to one host meanwhile wait for that one question. An allowance holds for the session, and for good once the
connection is kept; a decline sends nothing ("Not signed in: git.acme.com wasn't allowed") and isn't remembered: the
next sign-in is the user's own paste again, and asks again.

## Economy

The trackers' servers get the care `cm`'s does (CLAUDE.md "Every `cm` command earns its place"):

- One request per connection for every issue on screen (`IssueReadBatch`); never one per issue.
- `#`: one search as the list opens, kept a minute; then one per settled word of three characters or more, cached per
  words; a key typed is a batched read; a search a newer one replaced is aborted. Never one per key pressed.
- Read on a settled selection, a card opened, or a focus once stale; never on a timer.
- Cached five minutes, a missing issue too; a failure until it may be tried again.
- Connect's requests only when asked (the table above). Settings shows the projects' names and counts with one proof
  per project (`readProjects`), as the card shows and kept five minutes; never while a sign-in needs renewing.
- A refused credential, or a rate limit, stops requests to that connection or origin until they can succeed; nothing
  retries in a loop and nothing blocks.

## Adding a tracker

1. Its kind in `IssueTrackerKind`.
2. Its grammar (`shared/issueTrackers/grammars/<kind>.ts`), tested with its real link shapes; its place in
   `recognizeTrackerLink`'s order and in "Ambiguous links".
3. Its provider (`main/issueTrackers/providers/<kind>.ts`), its JSON parsers beside it, tested with `fakeTrackerHttp`
   and responses recorded from the tracker, its errors included.
4. Its sign-in methods (`signInMethodsFor`), its words (`trackerKindName`, `LINK_EXAMPLES`), and its rows in the
   tables above.

The registries' `Record`s fail to compile until 2 and 3 exist.

## Considered and dropped

- **A link stored by the app** (an issue per branch in its own store): every machine would need it and no other client
  would see it. The text already holds the link.
- **Recognizing any `ABC-123`**: `UTF-8`, `ISO-8859`, `SHA-256` would become issues. Only the bound projects' keys.
- **Reading `#N` with several GitHub repositories bound**: which one it names would be a guess.
- **Issue keys in any address**: a board's `?selectedIssue` isn't the issue's page; only an address showing itself, of
  an issue's own page, becomes a chip.
- **A second URL parser for addresses in comments**: the link node Markdown already read is the reference.
- **Telling an older GitLab's `/<group>/<project>/issues/N` from GitHub Enterprise Server**: the shapes are the same;
  such a link is read as Enterprise Server, and its sign-in says when it isn't one.
- **Connections in `settings.json`**: the renderer writes settings whole, so it could point a connection's token at
  another server. Their own store, changed only by typed methods.
- **One connection per server for every kind**: a fine-grained GitHub token covers one owner; a second
  organization's would have replaced the first's.
- **One connection per repository**: the second repository on the same site would sign in again.
- **Reading the token only from the clipboard, in main**: it kept the token out of the window, but a hidden ⌘V a paste
  target took over was unlike any sign-in people know, and no field was there for the keyboard or a password manager.
  A masked field.
- **Offering a token found on the clipboard** ("Use the copied token", checked as the window came back): a read the
  user didn't make can bring up the system's paste-privacy prompt (macOS), and it gave a window taken over nothing it
  couldn't read itself, while main reading it gave that window a way to send it. Paste into the field, which signs in
  at once.
- **Trusting the server a window names**: any address shaped like an issue reads as GitHub Enterprise Server, so a
  window taken over could have main send a credential to its own host. Main asks the user before the first one goes to
  a host no tracker is known by ("Host consent").
- **A generic `fetch` for the renderer**, or the renderer calling trackers itself: the renderer is untrusted and its
  Content-Security-Policy allows no connection out. Typed methods in main only.
- **`net.fetch` as it is**: it sends the default session's cookies. A session of its own.
- **One read per chip**: a comment with fifty keys would be fifty requests. Batched per task and connection.
- **`#` searching at every key, or from one character**: GitHub's search allows about 30 requests a minute, and a
  letter matches half a tracker. Settled words from three characters, over the account's open issues filtered locally.
- **`text ~` for `#`'s words**: it also searches descriptions and comments, which the row doesn't show, so a match
  looked unrelated. `summary ~`, the title the row shows.
- **A typed key searched as words**: a key names one issue, which the batched read already gets.
- **Keying bindings by the repository's GUID**: one more server command per window for a rare rename. The spec, moved
  on the app's own renames.
- **A setup screen of parameters per tracker** (user, password, host, branch prefix, a working mode), as older
  integrations have: the link holds the setup, and the sign-in is the only thing asked.
