# Issue trackers

Jira (Cloud and Data Center), GitHub (github.com, data residency and Enterprise Server), GitLab (gitlab.com and
self-hosted) and Linear, connected per user on each machine. A repository that uses a tracker shows the issues its
comments name as chips, with their title and status, and `#` in a comment suggests issues. Later features (an Issues
view, Start work, status where branches show, moving issues, merge requests) build on the pieces named here.

This design lands with its code: the pull request that builds it also updates ARCHITECTURE.md "What leaves the device"
(the trackers become a place data goes) and "Secrets" (`TrackerSecrets`, the token shapes `hideSecrets.ts` hides).
Until then those sections and this doc disagree, so this doc never reaches `main` alone.

## The principle: the link lives in the text

The app stores no link between an object and an issue. Comments and branch names already name issues
(`VCS-1009139`, `#123`, a pasted address), and every client (`cm`, the web, the Unity plugin, the official desktop
client) sees the same text. The app reads it: a reference is recognized in what is written, and the tracker only fills
in the title, status, type and assignee. With no tracker reachable, a reference is still a link.

No `cm` command and no UVCS server change: trackers are reached over HTTPS from the main process only.

## Layers

As ARCHITECTURE.md "How a request flows", with HTTPS in place of `cm`:

```
shared/domain/issueTrackers.ts     Types: kinds, connections, credentials' states, bindings, issues, status categories.
shared/issueTrackers/grammars/     One pure module per tracker kind: what its links and keys look like.
shared/issueTrackers/search/       Pure builders of each tracker's search text (JQL, GitHub's q).
shared/api/issueTrackers.ts        IssueTrackersApi, part of UvcsApi; the issueTrackersChanged event in shared/events.
main/issueTrackers/                IssueTrackerStore, TrackerSecrets, TrackerHttp, the providers.
main/services/issueTrackersService.ts   Wired in createServices.
renderer/src/components/issues/    The place's binding, issue reads (batched), the chip's card.
renderer/src/app/settings/         IssueTrackerPane.tsx, and connectFlow.ts, which decides every step of it.
```

Each tracker is two small modules that change together: its **grammar** (`shared/issueTrackers/grammars/<kind>.ts`,
pure, no network, used by both processes) and its **provider** (`main/issueTrackers/providers/<kind>.ts`, the HTTP
calls and the parsing of their JSON). A registry of each (`TRACKER_GRAMMARS`, `TRACKER_PROVIDERS`) is a
`Record<IssueTrackerKind, …>`, so a new kind doesn't compile until it has both.

The kinds are `jiraCloud`, `jiraDataCenter`, `github`, `gitlab` and `linear`. Jira is two kinds because Cloud and Data
Center are two APIs: another sign-in (an email and an API token as Basic, against a personal access token as Bearer),
another version of the REST API (v3, whose texts are Atlassian's document format, against v2), other endpoints for the
same read (`issue/bulkfetch` against `search`) and another token page. GitHub.com, its data residency hosts and
Enterprise Server share one API and differ only in where it is (`githubApiBase`), so they are one kind; GitLab.com and
a self-hosted GitLab likewise.

### The grammar (shared, pure)

`TrackerGrammar` says what a tracker's text looks like, with no network:

- `recognize(url)`: a link read back as a `RecognizedLink` (kind, `server`, `project`, the issue key, and whether it
  is the issue's own page or an issue shown in another view, `issuePage` or `issueInView`), a `NotAnIssueLink` that
  says what it is instead ("a Jira board", "a GitHub repository"), or null when it isn't this tracker's.
  `recognizeTrackerLink(url)` asks every grammar, in the order of "Ambiguous links" below.
- `referencesIn(text, binding)`: the issue references a comment holds for the repository's binding.
- `canonicalKey(reference, binding)`: the one form a key is cached and compared by (`VCS-12`, `owner/repo#12`).
- `issueUrl(server, key)`: the issue's page, which a chip opens.
- `tokenPageUrl(server, project)`: the page where a token is made, filled in where the tracker allows it.
- `tokenShape`: what a pasted token must look like (Sign-in).

### The provider (main)

`IssueTrackerProvider`, one per kind, each a small module:

- `signIn`: its sign-in method (`TrackerSignIn`, below), a piece of its own so browser sign-in replaces it later
  without touching the rest.
- `whoAmI(http)`: the account the credential belongs to (`TrackerAccount`: display name, login or email, id).
- `projectAccess(http, project)`: proof that the project can be read (`ProjectAccess`: its name, open issues and
  those assigned to the account, the counts optional where a tracker can't count).
- `readIssues(http, keys)`: the issues named, **one request for all of them** (`IssueRead[]`: `found`, `missing`, or
  `unreadable`, per key).
- `searchIssues(http, projects, search)`: issues by an `IssueSearch` (below), newest activity first.

A provider never holds a secret: it gets a `ConnectionHttp`, the HTTP client bound to one connection, which adds the
credential itself. JSON is read by pure parsers beside each provider (`jiraIssues.ts`, `githubIssues.ts`…), tested
with responses shaped exactly as each tracker returns them, its errors included.

Later capabilities (transitions, assign, close) are new methods on `IssueTrackerProvider` when they're built, each
with its fixtures per tracker; nothing is stubbed before. What a connection may do then is recorded per connection at
sign-in, beside its `access` (a Jira site's workflow, a token's scopes), not per kind.

### The HTTP client (main)

`TrackerHttp` (`main/issueTrackers/TrackerHttp.ts`) is the one way to a tracker, as `CmClient` is to `cm`.

- **Its own session**: requests go through `session.fromPartition('issue-trackers')`'s `fetch`, a session kept in
  memory and used for nothing else, with `credentials: 'omit'`: `net.fetch` alone uses the default session, whose
  cookies (a tracker's web sign-in, should a page ever set one) would go along. It keeps the system's proxy and
  certificates, which a company's Jira Data Center often needs.
- **The credential goes only where it belongs**: a request's origin must be one of the connection's
  (`connectionOrigins`: its server, and the API host its kind uses: `api.github.com`, `api.<name>.ghe.com`,
  `api.linear.app`, `api.atlassian.com`); any other is refused before it's sent. Redirects are `manual`: one to
  another origin is an error (`unexpected`), never followed, with or without the credential.
- **`https:` only**. A server given as `http:` is refused at Connect ("This server doesn't use a secure connection, so
  your token would travel readable"), unless the user confirms "Connect anyway" for it, which only a self-hosted kind
  offers (Jira Data Center, GitLab, GitHub Enterprise Server) and which the connection records (`insecure`).
- JSON in and out, a timeout (`TRACKER_REQUEST_TIMEOUT_MS`), and every failure as a `TrackerError` (below). Its
  message names the host and the path, never a query string, a header or a body.
- Each request is logged in the command log as its method, host and path, without the query (`GET
  unity3d.atlassian.net /rest/api/3/issue/bulkfetch`), so the budget can be counted as `cm`'s is (CLAUDE.md "Check
  it"); development builds warn `[tracker budget]` when the same request repeats more than twice in ten seconds, as
  `repeatedCommands.ts` does.

### Errors

`TrackerError`'s `reason` is one of `unreachable`, `signInRefused`, `noAccess`, `rateLimited` (with `until`) and
`unexpected`. Each tracker's way of saying them is read in one place per provider (`<kind>Errors.ts`), each case with
its recorded fixture:

| Reason | Jira Cloud and Data Center | GitHub | GitLab | Linear |
| --- | --- | --- | --- | --- |
| `signInRefused` | 401 | 401 | 401 | 401, or `extensions.type` `authentication_error` |
| `noAccess` | 403; 404 on a project | 403 without a rate limit; 404 on a repository | 403; 404 on a project | `forbidden` |
| `rateLimited` | 429, `Retry-After` | 200 with an error of type `RATE_LIMITED` (until `x-ratelimit-reset`); 403 or 429 with `retry-after` or `x-ratelimit-remaining: 0` (the secondary limit) | 429, `RateLimit-Reset` | `extensions.type` `ratelimited`, whatever the status, until `x-ratelimit-requests-reset` (checked against a recorded answer when built) |
| one key `missing`, the rest read | `bulkfetch` leaves it out; Data Center's `search` warns of it (`validateQuery: warn`) | its alias is null with an error of type `NOT_FOUND` | its alias is null | its alias is null with "Entity not found" |
| one key `unreadable`, the rest read | `bulkfetch`'s `issueErrors` | an alias's other error | an alias's other error | an alias's other error |

An error that names one alias is that key's answer; only an error with no alias fails the request.

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
- `now`, into `TrackerCooldown` and the credential's states.
- The store's file path, as `SettingsStore` takes it.

The Connect flow's decisions (which step shows, its words, which failure gets which message, what the suggestion
offers) live in `connectFlow.ts`, a pure module with its tests; `IssueTrackerPane` only maps its result to JSX. The
smoke test (`npm run e2e`) visits Settings, so it covers the section's empty state with no connection and no network.

## The data model

### Connection: a sign-in to a tracker

`TrackerConnection`: `id` (made by main), `kind`, `server` (`https://unity3d.atlassian.net`, `https://github.com`,
`https://git.example.com/gitlab`, a context path kept), `scope` (below), `account` (`TrackerAccount`), `signInMethod`
(`token` today), `access` (`read` today), `credential` (its state, below), `insecure` when the user accepted `http:`,
and for Jira Cloud the API base the token works with (`apiBase`: the site, or Atlassian's gateway for a scoped token).

What one sign-in covers depends on the kind, so a connection's identity is its kind, its server and its `scope`:

| Kind | One connection per | Why |
| --- | --- | --- |
| Jira Cloud, Jira Data Center | site (`server`) | A token reaches every project the account can read on its site. |
| GitHub | server and owner (`scope`: the user or organization), or server and every owner for a classic token | A fine-grained token covers one resource owner. |
| GitLab | server | A personal token reaches everything the account can read on its server. |
| Linear | workspace (`scope`: its url key, `acme` in `linear.app/acme/…`) | A personal API key belongs to one workspace. |

A second repository whose project the same connection covers reuses it: "Use Jira at unity3d.atlassian.net · signed
in as Daniel Peñalba" binds it in one click. A GitHub repository of another organization asks for that owner's
token and makes a second connection; the first stays as it was. Signing in again to the same identity replaces its
credential only.

**GitHub's classic tokens are accepted** when pasted, as a connection for every owner on that server: some
organizations allow only classic tokens, and an Enterprise Server too old for fine-grained ones has nothing else. The
app never asks for one: "Create a token" opens the fine-grained page, as a classic token's narrowest scope that reads
private issues (`repo`) also writes. A repository is served by the connection of its owner first, then by a classic one.

### Credential state

`TrackerConnection.credential` says whether reads can be made, so nothing asks a tracker with a credential it already
refused:

- `kept`: encrypted on disk, readable.
- `session`: held in memory for this session only (Linux with no keyring).
- `missing`: none to use. A `session` credential after the app restarts, a file lost, or `decryptString` throwing (the
  keychain refused it, the system's key changed).
- `refused`: the tracker answered 401 to it (expired, revoked).

The first 401 on any request sets `refused`; reads of a `missing` or `refused` connection fail at once as
`signInRefused`, with no request. Chips stay links, their card saying "Sign in to Jira again to see it". Settings shows
"Sign in again" on the connection, which keeps its bindings: a new credential for the same identity sets it `kept` (or
`session`) again, and every window reads its issues again.

### Binding: which repositories use it

`RepositoryTrackerBinding`: the repository, the `connectionId`, and its `projects` (one or more: Jira project keys
`VCS`, Linear team keys `ENG`, GitHub `owner/repo`, GitLab `group/subgroup/project`). One tracker per repository.

A repository is identified by its spec as `cm` names it (`name@server`, `usePlaceRepository`, an organization's
server by its name: ARCHITECTURE.md "Unity organizations"). The app reads no stable repository id for a place:
`cm repository list --format={repguid}` would be one more server command for every window opened, for a rename that
seldom happens. A repository renamed in the app (`repositories.rename`) moves its binding with it; renamed elsewhere,
Settings offers the connection again in one click.

What later features remember per repository goes on the binding: the branch naming pattern (Connect's naming step,
below) and the issue moves remembered as Ask, Always or Never. Neither is there until a feature uses it.

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
(`issue-tracker-secrets.json`, the encrypted bytes by connection id), read only by `TrackerHttp`, and read only once a
connection exists (the smoke test and a user with none never touch the keychain). A credential never crosses IPC
toward the renderer, never shows in a log, an error or a toast.

- **Linux without a keyring**: `safeStorage` is unavailable or would use its plain-text backend
  (`getSelectedStorageBackend()` is `basic_text`). The credential is kept in memory for the session only (`session`),
  and Settings says so: "Kept until you quit: this computer has no keyring." It's never written in plain text.
- **macOS development builds**: the first use asks for the Keychain's "Electron Safe Storage", and a rebuilt
  development app may ask again, as its signature changes; the signed app asks once, by its own name.
- **Hidden in text**: `hideSecrets.ts` also hides the token shapes trackers issue (`ghp_`, `github_pat_`, `glpat-`,
  `lin_api_`, Atlassian's `ATATT`), in any text logged (`textForLog`), as a second line of defense.
- Disconnecting the last repository keeps the connection for the next one; **Sign out** removes the connection, its
  credential and its bindings.

### Issue and reference

`Issue`: `key` in its canonical form (`VCS-1009139`, `owner/repo#123`), `title`, `status` (the tracker's own words),
`statusCategory`, `type` (Jira's issue type, "Issue" or "Pull request" on GitHub, GitLab's type, Linear's none),
`assignee` (a `TrackerAccount` or none), `url`. People's pictures, when a later feature shows them, come through main
as data URLs, as profile pictures do (ARCHITECTURE.md "Profile pictures"): a tracker's avatar needs its credential,
and the page reaches no tracker.

`IssueStatusCategory` is the same four for every tracker, so later UI colors any of them alike:

| Category | Jira (`statusCategory.key`) | GitHub | GitLab | Linear (`state.type`) |
| --- | --- | --- | --- | --- |
| `todo` | `new`, or none | open | open; status category triage or to do | `triage`, `backlog`, `unstarted` |
| `inProgress` | `indeterminate` | — | status category in progress | `started` |
| `done` | `done` | closed, `completed` | closed; status category done | `completed` |
| `canceled` | — | closed, `not_planned` or `duplicate` | status category canceled | `canceled` |

- **Jira** has three categories and no canceled one: a "Won't Do" status is in `done`, so it reads as done. A status
  read without a category is `todo`.
- **GitHub** tells only open or closed, and why closed (`stateReason`): an open issue is `todo`, its status still
  reading "Open" (the words are the tracker's, the category only colors them).
- **GitLab** tells open or closed, and on a namespace with configurable statuses (GitLab 18.2 and later, Premium) each
  issue's status names its category (triage, to do, in progress, done, canceled), read from its status when the
  answer has one (checked against a recorded answer when built).

A later "Done · not merged" warning reads `done` alone, never `canceled`. "In review" is no tracker's category: a later
feature that needs it reads the status's words.

An issue reference is `{ kind: 'issue'; key }` in `CommentReference`, `key` canonical, beside `cs:` and the others.

## How a reference is recognized

Only in a place whose repository has a binding: with none, nothing changes and no issue is read. The binding's grammar
reads the comment (`referencesIn`, joined by `findReferences(text, issueReferences)`), under the same rules as the
other references: never inside code or an image, and starting only after a space, a line's start, a bracket or an
emphasis mark. A reference the comment reads as another kind first (`br:/main/VCS-12`) stays that kind.

| Tracker | Written | Read as |
| --- | --- | --- |
| Jira, Linear | `VCS-1009139` | an issue of a bound project: its key upper case as the tracker writes it, ending at a non-word character. `ABC-123`, `UTF-8`, `ISO-8859` are no project's, so nothing |
| GitHub, GitLab | `#123` | an issue of the bound repository or project, only when the binding has exactly one |
| GitHub | `owner/repo#123` | that repository's issue, on the same server |
| GitLab | `group/subgroup/project#123` | that project's issue, on the same server |
| Any | an issue's own page on the bound server, as a link showing its own address | that issue |

**`#` and a number** is read only as GitHub and GitLab write it: digits only, with no leading zero, after a space, a
line's start, a bracket or an emphasis mark, and ending at a non-word character. Never after a letter or a digit, `&`,
`/`, `.`, `:`, `#`, `\` or `-`, so `&#123;`, `docs/a.md#12` and `a#1` hold none. A color written as digits
(`#112233`) and "the #1 cause" are read as GitHub reads them, but an issue the tracker reports `missing` shows as the
text it is, never as a chip: only an issue that exists, or one not read yet, is a chip.

**Issue addresses** are the one reference read inside a link. Markdown (GitHub's) makes a bare `https://…` a link,
and `writtenRanges` (`isWrittenAsIs`, `lib/markdown.ts`) keeps every reference out of a link. The exception, named in
`isWrittenAsIs`: a link whose text is its own address (a bare address, or `<https://…>`) and which
`recognizeTrackerLink` reads as an issue's own page (`issuePage`) on the bound server, of a bound project, is that
issue's reference. Everything else stays as it was:

- `[the bug](https://…/browse/VCS-12)` stays a link: its text is the author's.
- An address that only holds a key in its query or fragment (`…/secure/Dashboard.jspa?issue=VCS-12`, a Jira board's
  `?selectedIssue=VCS-12`, `issueInView`) stays an address. Connect takes it as a sample; a comment doesn't take it as
  the issue.
- Another server's issue page stays an address.

Each of these gets a test in `markdown.test.ts`: a bare issue address and an angle-bracketed one become the issue; a
link with its own text, an address with the key in its query, a board's `selectedIssue`, another server's and another
project's stay links.

### Ambiguous links

`recognizeTrackerLink` reads the address's shape first, its host second:

| Shape | Read as |
| --- | --- |
| `*.atlassian.net` or `*.jira.com`, `/browse/KEY-N` | Jira Cloud, an issue page |
| any other host, `<base>/browse/KEY-N` (the base may hold a context path, `/jira`) | Jira Data Center, an issue page |
| a Jira link with `?selectedIssue=KEY-N` (a board, a backlog, a search) | that kind, the issue in a view |
| `<base>/<group>/…/<project>/-/issues/N` (`/-/` is GitLab's alone) | GitLab, gitlab.com or self-hosted |
| `github.com/<owner>/<repo>/issues/N` | GitHub |
| `<name>.ghe.com/<owner>/<repo>/issues/N` | GitHub with data residency, its API at `api.<name>.ghe.com` |
| any other host, `/<owner>/<repo>/issues/N` | GitHub Enterprise Server, but also an older GitLab's shape (before `/-/`): read as GitHub Enterprise Server, and confirmed at sign-in, whose answer tells them apart (a GitLab server answers its own API, not `/api/v3`): then it is GitLab, and Connect says so |
| `linear.app/<workspace>/issue/KEY-N/…` | Linear |

## How references show and read

- **The chip** is the comments' own (`chipContent`'s new `issue` kind, `ReferenceChip`): the tracker's icon, the key,
  and in a comment shown in full the title once read. Its card (`ChipHoverCard`) shows the title, the status in its
  category's color, the type and the assignee. A click opens the issue's page in the browser (`openReference`'s `issue`
  case: `issueUrl`, `openExternal`). Copying a part of a comment gives the reference as written (`copiedText`).
- **Without a sign-in, or when the tracker fails** (rate limited, out of reach, no access, credential refused), the
  chip is still a link to the issue's page, and its card says why there's nothing more ("Sign in to Jira to see it",
  "Jira couldn't be reached"). Nothing waits on a tracker to draw.
- **When it reads**: through the same two doors as another repository's objects (rich-comments.md "What a chip
  reads"): a comment shown in full reads its issues once what it shows stayed put (`useKeySettled`), and a row's chip
  only while its card is open. Arrowing through rows reads nothing. `remoteReadRules.test.ts` holds issue reads to
  those doors too.
- **Batched**: each issue is its own query, `queryKeys.issue(connectionId, key)` with the canonical key, so a chip
  anywhere finds what another read, however it was written. Their reads go through `IssueReadBatch`, which gathers
  every key asked in the same task, splits them per connection and asks `issueTrackers.readIssues` once per
  connection, one request to the tracker for all of its keys: Jira Cloud's `POST /rest/api/3/issue/bulkfetch`, Jira Data
  Center's `POST /rest/api/2/search` (`key in (…)`, `validateQuery: warn`), GitHub's and GitLab's GraphQL with one alias
  per issue, Linear's GraphQL likewise. At most 100 keys per request. The shared request belongs to no one query:
  cancelling one (its chip unmounted) never aborts it, and its answer fills every query that asked.
- **Cached** (`ISSUE_QUERY`): `staleTime` five minutes; `refetchOnWindowFocus: true`, so a focus reads again only the
  issues on screen and only once stale; `refetchOnReconnect: false`; `retry: false`, as `TrackerHttp` and its cooldown
  decide when to ask again. A `missing` issue is kept as long as a found one. A failure is an answer too
  (`unreadable`, with when to try again), kept for `UNREADABLE_ISSUE_RETRY_MS` (five minutes, as
  `UNREADABLE_RETRY_MS`), or until the tracker's cooldown ends if sooner (`staleTime` read from the answer). Never on a
  timer.

### Every comment surface

The binding reaches the comment readers as an option, never from module state: `MarkdownOptions.issues` (an
`IssueReferenceReader` built from the binding by `issueReferenceReader`, null with none), from `useIssueReferences()`,
which reads the place's binding from the `issueTrackers.setup` query.

| Surface | What changes |
| --- | --- |
| A comment shown in full (`Markdown` with `comment`: details panels through `FoldedComment`, `SummaryComment`, `RevisionHeader`, `AnnotationCard`, `GraphTooltip`, the Branch Explorer's caption card) | Issue chips, read on a settled selection |
| A comment's line in a row (`CommentLine`, `commentLineInlines`: every list, Incoming, the pickers) | Compact issue chips, read while their card is open |
| The editor (`liveMarks`' chips, `suggestionItems`) | Issue chips as typed; `#` suggestions |
| What holds only text (`commentText`, `commentLineText`: the Branch Explorer's canvas, its tooltips, the palette, notifications) | Nothing: a reference already shows as written, so these take no reader, and `mayHoldReference`'s fast path stays as it is |

## `#` in the comment editor

`#` is the editor's own trigger, beside `:` (`SUGGESTION_TRIGGERS`), on only in a place whose repository has a
binding (`suggestionGate`); without one it opens nothing and stays the text it is. It doesn't join `KIND_PREFIXES`
here: the palette gets `#` and an Issues section later. `sharedPrefixes.test.ts` changes with it: the editor's own
triggers are `[':', '#']`, and its "`#` is no one's" case becomes "`#` is the editor's, for issues; the palette doesn't
read it".

- **Not a heading**: `#` followed by a space or another `#` closes the list, and the text stays as typed (`# Title`,
  `## Notes`); Enter there is a line end, never a pick. `suggestionQueryAt`'s tests hold it.
- **The list** opens on the key with the account's open issues in the bound projects (`searchIssues` with
  `assignee: 'me'`, one request, cached as its own query), filtered locally as the user types. Only from three
  characters, and once typing pauses (`SERVER_SEARCH_DELAY_MS`), does it ask the tracker for the words; GitHub's search
  allows about 30 requests a minute. A key or a number typed is matched first. The last answer stays while typing, as
  the people search does. "Reading issues…", "Couldn't read issues" and "Sign in to Jira to see issues" are its rows
  when it has none.
- **A pick** writes the tracker's own form: `VCS-1009139`, `#123`, or `owner/repo#123` for another repository or a
  binding of several. Never a new syntax: the comment stores the text, and every other client reads it as before.

### Searching

`searchIssues` takes an `IssueSearch`: `words?`, `assignee?` (`'me'`, or an account), `categories?` (status
categories), `limit`. Each tracker's search text is built by a pure function with its tests, which puts the user's
words only where they can be words, so typing `repo:other` or `" OR project = X` can never widen a search:

- `jiraSearchJql(search, projects)`: the projects and filters as JQL clauses, the words in one quoted `text ~ "…"`
  string, `"` and `\` escaped as JQL takes them.
- `githubSearchQuery(search, repositories)`: the qualifiers (`repo:`, `is:issue`, `is:open`, `assignee:@me`) written by
  the app, the words each in double quotes, `"` dropped from them, so none reads as a qualifier.
- GitLab and Linear take the words as a variable of their own (GitLab's `search`, Linear's `term`), never inside a
  query's text.

## Connecting: Settings › Issue tracker

One section, for the window's repository. A window with no repository (the home screen) lists the connections, each
with Sign out. Its steps, each one state of the same section:

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
   unity3d.atlassian.net · signed in as Daniel Peñalba" binds it in one click. Otherwise the sign-in method's own step
   (below). Jira Cloud asks for the account's email there too, filled in with the `cm` user when that is an email
   address (as on Unity Cloud), and remembered on the connection's account for signing in again; it's no secret.
5. **Proof**: "Signed in as Daniel Peñalba" and "Project VCS · 214 open issues, 6 assigned to you"
   (`projectAccess`). The pasted issue isn't shown back: it was a sample. Sign-in works but the project can't be read:
   the message names the project.
6. **Done**: the section shows the repository's tracker, projects and account, with Change (paste another link),
   Disconnect (this repository), "Add a project" by another link, and on a credential `refused` or `missing`, "Sign in
   again".

The words for each failure: "That's a link to a Jira board, not an issue. Open any issue and copy its address.",
"Jira didn't accept this token for daniel@example.com. Check the email, or create a new token.", "Jira couldn't be
reached at unity3d.atlassian.net.", "That doesn't look like a GitHub token. Copy it again from GitHub."

Left out until a feature uses them: a naming step, which would learn how the team names branches from the branches
already read and show the pattern on a real branch (`scm1009134` is `VCS-1009134`), and a closing summary of how many
branches are linked to issues. Their place is the binding (the pattern) and step 6 (the summary).

### What Connect asks each tracker

Only when the user goes through it, each a request:

| Tracker | Requests |
| --- | --- |
| Jira Cloud | `GET /rest/api/3/myself` on the site; on a 401, `GET /_edge/tenant_info` (the cloud id) and `myself` again through the gateway (a scoped token); `GET /rest/api/3/project/<key>`; `POST /rest/api/3/search/approximate-count` twice (open, and open assigned to the account). 4, or 6 for a scoped token |
| Jira Data Center | `GET /rest/api/2/myself`, `GET /rest/api/2/project/<key>`, `POST /rest/api/2/search` with `maxResults: 0` twice. 4 |
| GitHub | One GraphQL query: the viewer, the repository's open issues (`issues(states: OPEN) { totalCount }`, which counts no pull requests, unlike REST's `open_issues_count`) and the open ones assigned to the viewer (`search(type: ISSUE, query: "repo:… is:issue is:open assignee:@me") { issueCount }`). 1 |
| GitLab | `GET /api/v4/user`, then one GraphQL query for the project and its two counts (`issues(state: opened) { count }`, and assigned to that user). 2 |
| Linear | One GraphQL query: the viewer, the workspace's url key and the team by its key. Counts only if Linear can count without listing (checked when built), else the team's name alone. 1 |

## Sign-in

`TrackerSignIn` is each provider's method, a union that grows: `{ kind: 'token', … }` today, `{ kind: 'browser', … }`
when the trackers' app registrations exist. Everything after it (the connection, `whoAmI`, the proof) is the same for
any method.

### Token

For every tracker today. "Create a token" opens the tracker's page in the browser, filled in where it allows it. The
user copies the token there and comes back:

- **Paste token**, a button, or ⌘V (Ctrl+V) on the sign-in step: a paste target there cancels the page's `paste`
  event without reading it (`preventDefault`, never `clipboardData`) and asks main to read the clipboard
  (`issueTrackers.signInWithClipboard`). Main reads it (`readClipboard`), trims it and checks its shape for the kind
  (`tokenShape`): `ghp_` or `github_pat_` for GitHub, `lin_api_` for Linear, `ATATT` or a classic Atlassian token for
  Jira Cloud; where no prefix is certain (Jira Data Center's tokens, a GitLab whose admin changed `glpat-`), only its
  length and characters. A text that isn't a token is never sent anywhere ("That doesn't look like a GitHub token").
- `signInWithClipboard` takes the pasted link, not a server: main runs `recognizeTrackerLink` on it itself, so a
  window can't name the server a token goes to. Jira Cloud's email goes with it.
- Signed in, main clears the clipboard if it still holds that token (`clearClipboard`), so it isn't pasted somewhere
  by mistake later.

The token never enters the renderer, so it never crosses IPC. What remains: between the copy and the paste, any app
that reads the clipboard can read the token, as with any copy and paste; a clipboard manager keeps it in its history
whatever the app clears. A token field would be the usual way and would let a password manager fill it; switching to
it means a field whose text goes to `signInWithToken` once, toward main, and nothing else changes (`tokenShape`, the
connection, the proof).

| Tracker | Token page | Read access asked | Sent as |
| --- | --- | --- | --- |
| Jira Cloud | `https://id.atlassian.com/manage-profile/security/api-tokens` (nothing to fill in) | a classic token, or one scoped `read:jira-work`, `read:jira-user` | Basic, the account's email and the token. A scoped token works only through `https://api.atlassian.com/ex/jira/<cloudId>`: sign-in tries the site, then the gateway, and keeps what worked (`apiBase`) |
| Jira Data Center | `<server>/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens` (checked when built) | a personal access token (it has the user's own permissions) | Bearer |
| GitHub | `<server>/settings/personal-access-tokens/new?name=UVCS+Desktop&target_name=<owner>&issues=read` (fine-grained, filled in; on Enterprise Server the parameters may be ignored, and the page opens all the same) | Issues: read (and Metadata: read, always given) | Bearer; the API at `api.github.com`, `api.<name>.ghe.com`, or `<server>/api/v3` and `<server>/api/graphql` |
| GitLab | `<server>/-/user_settings/personal_access_tokens?name=UVCS+Desktop&scopes=read_api` | `read_api` | Bearer |
| Linear | `https://linear.app/<workspace>/settings/account/security` (checked when built) | a personal API key with Read only | The key alone in `Authorization` (no Bearer) |

**Asking for more later**: a connection records the access it asked for (`access: 'read'`). A feature that needs to
write (move, assign) asks `ensureAccess(connection, 'write')`, which opens the same sign-in step with the wider access
when the connection's is narrower, and a tracker refusing a write as `noAccess` leads there too. A token's real scopes
can't always be read back (GitHub's fine-grained tokens don't say), so the refusal is the proof.

### Browser sign-in, when it comes

What each tracker needs:

- **GitHub** (github.com and data residency): an OAuth app or a GitHub App registered by Unity with the device flow
  enabled (no client secret in the app); a GitHub App gives `Issues: read` alone, but must be installed on each
  organization. Enterprise Server: an app registered on each server by its admin, so tokens stay its default.
- **GitLab** (gitlab.com): a non-confidential OAuth application with PKCE or the device grant, scope `read_api`.
  Self-hosted: an application per instance, by its admin; tokens stay its default.
- **Linear**: an OAuth app with PKCE (no secret), scope `read`, a redirect to the app.
- **Jira Cloud**: an OAuth 2.0 (3LO) app in Atlassian's developer console (`read:jira-work`, `read:jira-user`,
  `offline_access`). Atlassian's code exchange and refresh need the client secret (no PKCE on Cloud), which a desktop
  app can't keep. How to answer that is open: a small stateless token service Unity would host, or waiting for PKCE
  on Cloud; until then the API token is the way in. Jira Data Center: an incoming application link made by each site's
  admin (PKCE works there); tokens stay its default.
- For all: a redirect back to the app (`uvcs://` is registered already, docs/features/deep-links.md, or a loopback
  address), and refresh tokens kept in `TrackerSecrets` like any credential.

## Economy

The trackers' servers get the care `cm`'s does (CLAUDE.md "Every `cm` command earns its place"):

- One request per connection for every issue on screen (`IssueReadBatch`, the providers' batch reads); never one per
  issue.
- Read on a settled selection, a card opened, a `#` typed, or a focus once stale; never on a timer.
- Cached five minutes, a missing issue too; a failure until it may be tried again.
- `#` filters the account's open issues locally, and searches the tracker only from three characters, once typing
  pauses.
- Connect's requests only when asked (the table above).
- A refused credential, or a rate limit, stops requests to that connection or origin until they can succeed; nothing
  retries in a loop and nothing blocks.

## Adding a tracker

1. Its kind in `IssueTrackerKind`.
2. Its grammar (`shared/issueTrackers/grammars/<kind>.ts`): `recognize`, `referencesIn`, `canonicalKey`, `issueUrl`,
   `tokenPageUrl`, `tokenShape`, tested with its real link shapes; its place in "Ambiguous links".
3. Its provider (`main/issueTrackers/providers/<kind>.ts`), its JSON parsers and errors beside it, tested with
   `fakeTrackerHttp` and responses recorded from the tracker, its errors included; its search builder if its search
   takes text.
4. Its row in "One connection per", in the status table and in "What Connect asks"; its words and icon
   (`trackerWords`, `TrackerIcon`).

The registries' `Record`s fail to compile until 2 and 3 exist.

## Adding a capability

A method on `IssueTrackerProvider` (and on `IssueTrackersApi` for the renderer), built for every tracker with its
fixtures. What a connection may do is recorded on it at sign-in where it differs (a token's scopes, a site's
workflow), and the UI reads it to leave an action out. Writes ask `ensureAccess('write')` first and refresh the issues
they change (their query keys), as operations declare what they affect.

## Considered and dropped

- **A link stored by the app** (an issue per branch in its own store, as integrations often do): every machine would
  need it and no other client would see it. The text already holds the link.
- **Recognizing any `ABC-123`**: `UTF-8`, `ISO-8859`, `SHA-256` would become issues. Only the bound projects' keys.
- **Reading `#N` with several GitHub or GitLab projects bound**: which project it names would be a guess.
- **Issue keys in any address**: a dashboard's `?issue=VCS-12` or a board's `?selectedIssue` isn't the issue's page;
  only an address showing itself, of an issue's own page, becomes a chip.
- **Connections in `settings.json`**: the renderer writes settings whole, so it could point a connection's token at
  another server. Their own store, changed only by typed methods.
- **One connection per server for every kind**: a GitHub fine-grained token covers one owner, and a Linear key one
  workspace; a repository of a second organization would have replaced the first's token, breaking its repositories.
  Per kind: a Jira site, a GitLab server, a GitHub server and owner, a Linear workspace.
- **One connection per repository**: the second repository on the same site would sign in again.
- **The token in a field**: it would cross IPC and live in the renderer. Read from the clipboard by main, pending the
  user's choice ("Token").
- **A server sent by the window at sign-in**: a window taken over could send the token to its own host. Main reads the
  pasted link itself.
- **A generic `fetch` for the renderer**, or the renderer calling trackers itself: the renderer is untrusted and its
  Content-Security-Policy allows no connection out. Typed methods in main only.
- **`net.fetch` as it is**: it sends the default session's cookies. A session of its own, no credentials but the
  connection's.
- **One read per chip**: a comment with fifty keys would be fifty requests. Batched per task and connection.
- **Searching GitHub at every key**: its search allows about 30 requests a minute. The account's issues filtered
  locally, the tracker asked from three characters.
- **User words pasted into JQL or GitHub's `q`**: a typed `repo:other` would widen the search. Pure builders quote them.
- **Capabilities per kind**: what a connection may do depends on its token and its site's workflow, not on the
  tracker. Recorded per connection when the first write arrives.
- **Keying bindings by the repository's GUID**: one more server command per window for a rare rename. The spec, moved
  on the app's own renames.
- **A setup screen of parameters per tracker** (user, password, host, branch prefix, a working mode), as older
  integrations have: the link holds the setup, and the sign-in is the only thing asked.
- **One tracker per repository is the rule for now**; the binding's `projects` take several projects of that tracker.
