# Issue trackers

Jira (Cloud and Data Center), GitHub (github.com and Enterprise Server), GitLab (gitlab.com and self-hosted) and
Linear, connected per user on each machine. A repository that uses a tracker shows the issues its comments name as
chips, with their title and status, and `#` in a comment suggests issues. Later features (the Issues view, Start work,
status where branches show, moving issues, merge requests) build on the pieces named here.

## The principle: the link lives in the text

The app stores no link between an object and an issue. Comments and branch names already name issues
(`VCS-1009139`, `#123`, a pasted address), and every client (`cm`, the web, the Unity plugin, the official desktop
client) sees the same text. The app reads it: a reference is recognized in what is written, and the tracker only fills
in the title, status, type and assignee. With no tracker reachable, a reference is still a link.

No `cm` command and no UVCS server change: trackers are reached over HTTPS from the main process only.

## Layers

As ARCHITECTURE.md "How a request flows", with HTTPS in place of `cm`:

```
shared/domain/issueTrackers.ts     Types: kinds, connections, bindings, issues, status categories, setup.
shared/issueTrackers/grammars/     One pure module per tracker kind: what its links and keys look like.
shared/api/issueTrackers.ts        IssueTrackersApi, part of UvcsApi.
main/issueTrackers/                IssueTrackerStore, TrackerSecrets, TrackerHttp, the providers.
main/services/issueTrackersService.ts   Wired in createServices.
renderer/src/components/issues/    The place's tracker, issue reads (batched), the chip's card.
renderer/src/app/settings/IssueTrackerPane.tsx   Settings › Issue tracker.
```

Each tracker is two small modules that change together: its **grammar** (`shared/issueTrackers/grammars/<kind>.ts`,
pure, no network, used by both processes) and its **provider** (`main/issueTrackers/providers/<kind>.ts`, the HTTP
calls and the parsing of their JSON). A registry of each (`TRACKER_GRAMMARS`, `TRACKER_PROVIDERS`) is a
`Record<IssueTrackerKind, …>`, so a new kind doesn't compile until it has both.

### The grammar (shared, pure)

`TrackerGrammar` says what a tracker's text looks like, with no network:

- `recognize(url)`: a pasted link read back as a `RecognizedLink` (kind, `server`, `project`, the issue key), a
  `NotAnIssueLink` that says what it is instead ("a Jira board", "a GitHub repository"), or null when it isn't this
  tracker's. `recognizeTrackerLink(url)` asks every grammar; Connect reads the pasted link with it, and the comment
  chips read issue addresses with the same function.
- `referencesIn(text, binding)`: the issue references a comment holds for the repository's binding (below).
- `issueUrl(server, key)`: the issue's page, which a chip opens.
- `tokenPageUrl(server, project)`: the page where a token is made, filled in where the tracker allows it.

### The provider (main)

`IssueTrackerProvider`, one per kind, each a small module:

- `signIn`: its sign-in method (`TrackerSignIn`, below), a piece of its own so browser sign-in replaces it later
  without touching the rest.
- `whoAmI(http)`: the account the credential belongs to (`TrackerAccount`: display name, login or email, id).
- `projectAccess(http, project)`: proof that the project can be read (`ProjectAccess`: its name, open issues and
  those assigned to the account, the counts optional where a tracker can't count cheaply).
- `readIssues(http, keys)`: the issues named, **one request for all of them** (`IssueRead[]`: found, missing, or
  unreadable).
- `searchIssues(http, projects, query)`: the account's open issues (`mine`), or the issues matching words, newest
  activity first, at most `ISSUE_SEARCH_LIMIT` (20).

A provider never holds a secret: it gets a `ConnectionHttp`, the HTTP client bound to one connection, which adds the
credential itself. JSON is read by pure parsers beside each provider (`jiraIssues.ts`, `githubIssues.ts`…), tested
with responses shaped exactly as each tracker returns them.

Later capabilities (transitions, assign, move, close) are new methods on `IssueTrackerProvider` when they're built,
each with its fixtures per tracker; nothing is stubbed before. A tracker that can't do one says so in its grammar's
`capabilities` set, which the UI reads to leave the action out (GitHub has no transitions, only close and reopen).

### The HTTP client (main)

`TrackerHttp` (`main/issueTrackers/TrackerHttp.ts`) is the one way to a tracker, as `CmClient` is to `cm`. Built on
Electron's `net.fetch` (the system's proxy and certificates, which a company's Jira Data Center often needs), passed in
so tests replace it:

- **The credential goes only where it belongs**: a request's origin must be one of the connection's
  (`connectionOrigins`: its server, and the API host its kind uses, `api.github.com`, `api.linear.app`,
  `api.atlassian.com`); any other is refused before it's sent. A redirect to another origin is not followed with the
  credential.
- JSON in and out, a timeout (`TRACKER_REQUEST_TIMEOUT_MS`), and every failure as a `TrackerError` with a `reason`:
  `unreachable`, `signInRefused` (401), `noAccess` (403, or 404 on a project), `rateLimited` (with `until`),
  `unexpected`. Its message names the host and the path, never a header or a body.
- **Rate limits**: a 429, or a 403 with GitHub's `x-ratelimit-remaining: 0`, puts the origin to rest until its
  `Retry-After` or reset (`TrackerCooldown`); meanwhile its reads fail at once as `rateLimited`, without a request.
- Each request is logged in the command log as the method and the address (`GET unity3d.atlassian.net
  /rest/api/3/issue/bulkfetch`), so the budget can be counted as `cm`'s is (CLAUDE.md "Check it"); development builds
  warn `[tracker budget]` when the same request repeats more than twice in ten seconds, as `repeatedCommands.ts` does.

Tests use `fakeTrackerHttp` (`main/issueTrackers/testing/`), shaped as `fakeCmClient`: it answers the requests a test
declares (method, address, body) with JSON recorded from each tracker, records what it was asked, and fails the test
on any request it wasn't told about. No test touches the network.

## The data model

### Connection: a sign-in to a tracker

`TrackerConnection`: `id` (made by main), `kind` (`jiraCloud`, `jiraDataCenter`, `github`, `gitlab`, `linear`),
`server` (`https://unity3d.atlassian.net`, `https://github.com`, `https://git.example.com/gitlab`, a context path kept),
`account` (`TrackerAccount`), `signInMethod` (`token` today), `access` (`read` today) and, for Jira Cloud, the API base
the token works with (`apiBase`: the site, or Atlassian's gateway for a scoped token, below).

One connection per kind and server: a second repository on the same Jira reuses it (the study's frame 8), and
signing in again replaces its credential.

### Binding: which repositories use it

`RepositoryTrackerBinding`: the repository, the `connectionId`, and its `projects` (one or more: Jira project keys
`VCS`, Linear team keys `ENG`, GitHub `owner/repo`, GitLab `group/subgroup/project`). One tracker per repository.

A repository is identified by its spec as `cm` names it (`name@server`, `usePlaceRepository`, an organization's
server by its name: ARCHITECTURE.md "Unity organizations"). The app reads no stable repository id for a place:
`cm repository list --format={repguid}` would be one more server command for every window opened, for a rename that
seldom happens. A repository renamed in the app (`repositories.rename`) moves its binding with it; renamed elsewhere,
Settings offers the connection again in one click.

What later features remember per repository goes on the binding: the branch naming pattern (the study's frame 6)
and the issue moves remembered as Ask, Always or Never. Neither is there until a feature uses it.

### Where they're kept

`IssueTrackerStore` (`main/issueTrackers/IssueTrackerStore.ts`) keeps connections and bindings in
`issue-trackers.json` in the user data folder, replaced whole (`replaceFileSync`), as `SettingsStore` does, but apart
from `settings.json`: the renderer writes any setting with `settings.update`, and a renderer that could change a
connection's `server` could send its token anywhere. The store changes only through `IssueTrackersApi`'s typed methods,
and a connection's server never changes: another server is another connection.

### Secrets

`TrackerSecrets` keeps each connection's credential encrypted with Electron's `safeStorage`
(`issue-tracker-secrets.json`, the encrypted bytes by connection id), read only by `TrackerHttp`. A credential never
crosses IPC toward the renderer, never shows in a log, an error or a toast.

- **Linux without a keyring**: `safeStorage` is unavailable or would use its plain-text backend
  (`getSelectedStorageBackend()` is `basic_text`). The credential is then kept in memory for the session only, and
  Settings says so: "Kept until you quit: this computer has no keyring." It's never written in plain text.
- **Hidden in text**: `hideSecrets.ts` also hides the token shapes trackers issue (`ghp_`, `github_pat_`, `glpat-`,
  `lin_api_`, Atlassian's `ATATT`), in any text logged (`textForLog`), as a second line of defense.
- Disconnecting the last repository keeps the connection for the next one; **Sign out** removes the connection, its
  credential and its bindings.

### Issue and reference

`Issue`: `key` as the tracker writes it (`VCS-1009139`, `owner/repo#123`), `title`, `status` (the tracker's own
words), `statusCategory`, `type` (Jira's issue type, "Issue" or "Pull request" on GitHub, GitLab's type, Linear's
none), `assignee` (a `TrackerAccount` or none), `url`.

`IssueStatusCategory` is the same four for every tracker, so later UI colors any of them alike:

| Category | Jira | GitHub | GitLab | Linear |
| --- | --- | --- | --- | --- |
| `todo` | `statusCategory.key` `new` | open | opened | `triage`, `backlog`, `unstarted` |
| `inProgress` | `indeterminate` | — | — | `started` |
| `done` | `done` | closed, `completed` | closed | `completed` |
| `canceled` | — | closed, `not_planned` | — | `canceled` |

GitHub and GitLab tell only open or closed: an open issue is `todo`, its status still reading "Open" (the words are
the tracker's, the category only colors them). A later "Done · not merged" warning reads `done` alone, never
`canceled`. "In review" is no tracker's category: a later feature that needs it reads the status's words.

An issue reference is `{ kind: 'issue'; key; project }` in `CommentReference`, beside `cs:` and the others.

## How a reference is recognized

Only in a place whose repository has a binding: with none, nothing changes and no issue is read. The binding's grammar
reads the comment (`referencesIn`, joined by `findReferences(text, issueReferences)`), under the same rules as the
other references: never inside code, a link's text or an image, and starting only after a space, a line's start, a
bracket or an emphasis mark. A reference the comment reads as another kind first (`br:/main/VCS-12`) stays that kind.

| Tracker | Written | Read as |
| --- | --- | --- |
| Jira, Linear | `VCS-1009139` | an issue of a bound project: its key upper case as the tracker writes it, ending at a non-word character. `ABC-123`, `UTF-8`, `ISO-8859` are no project's, so nothing |
| GitHub, GitLab | `#123` | an issue of the bound repository or project (the first, when there are several) |
| GitHub | `owner/repo#123` | that repository's issue, on the same server |
| GitLab | `group/subgroup/project#123` | that project's issue, on the same server |
| Any | a bare address of the bound server that `recognize` reads as an issue | that issue: `https://unity3d.atlassian.net/browse/VCS-12`, `…/owner/repo/issues/12`, `…/group/project/-/issues/12`, `linear.app/acme/issue/ENG-12/…` |

A Markdown link (`[the bug](https://…/issues/12)`) stays a link: its text is the author's. A key of a project the
binding doesn't name is plain text, so a comment never shows a chip for an issue that may be another tracker's.

## How references show and read

- **The chip** is the comments' own (`chipContent`, `ReferenceChip`): the tracker's icon, the key, and in a comment
  shown in full the title once read. Its card (`ChipHoverCard`) shows the title, the status in its category's color,
  the type and the assignee. A click opens the issue's page in the browser (`issueUrl`, `openExternal`).
- **Without a sign-in, or when the tracker fails** (rate limited, out of reach, no access), the chip is still a link
  to the issue's page, and its card says why there's nothing more ("Sign in to Jira to see it", "Jira couldn't be
  reached"). Nothing waits on a tracker to draw.
- **When it reads**: through the same two doors as another repository's objects (rich-comments.md "What a chip
  reads", `remoteReadRules.test.ts`): a comment shown in full reads its issues once what it shows stayed put
  (`useKeySettled`), and a row's chip only while its card is open. Arrowing through rows reads nothing.
- **Batched**: each issue is its own query (`queryKeys.issue(repository, key)`), so a chip anywhere finds what
  another read. Their reads go through `IssueReadBatch`, which gathers every key asked in the same task and asks
  `issueTrackers.readIssues` once, one request to the tracker for all of them. Jira Cloud's
  `POST /rest/api/3/issue/bulkfetch`, Jira Data Center's `POST /rest/api/2/search` (`key in (…)`,
  `validateQuery: warn`, so a key that doesn't exist doesn't fail the rest), GitHub's and GitLab's GraphQL with one
  alias per issue, Linear's GraphQL likewise. At most 100 keys per request.
- **Cached** with the slow-changing idiom: five minutes fresh (`ISSUE_QUERY`, `SLOW_CHANGING_QUERY`'s time), read
  again on a window's focus only once stale and only for the chips on screen; a missing issue is kept as missing for
  the same time. Never on a timer.

## `#` in the comment editor

With a binding, `#` opens issue suggestions (`'#': 'issue'` joins `KIND_PREFIXES`; the palette's `SCOPE_PREFIXES` leaves
it out until the palette reads issues). Without one it opens nothing and stays the text it is.

- The list opens on the key with the account's open issues (`searchIssues` `mine`, one request, cached as an issue
  list), then, once typing pauses (`SERVER_SEARCH_DELAY_MS`), the tracker's search for the words typed (Jira's JQL
  `text ~`, GitHub's issue search, GitLab's `search`, Linear's `searchIssues`); a key or a number typed is matched
  first. The last answer stays while typing, as the people search does. "Reading issues…", "Couldn't read issues",
  and "Sign in to Jira to see issues" are its rows when it has none.
- A pick writes the tracker's own form: `VCS-1009139`, `#123`, or `owner/repo#123` for another repository. Never a
  new syntax: the comment stores the text, and every other client reads it as before.

## Connecting: Settings › Issue tracker

One section, in the study's "Connect" storyboard, for the window's repository. A window with no repository (the home
screen) lists the connections, each with Sign out.

1. **Empty**: one sentence ("Paste a link to any issue from your tracker."), the field's placeholder shaped like an
   issue link, and the link shapes per tracker under it.
2. **A suggestion**: when the branch comments the window already read hold issue addresses a grammar recognizes
   (`suggestedTrackerLinks`, over the cached branch lists, no command), "Your branch comments link to Jira" with
   the server and project, how many comments, and "Use this", which fills the field. Never filled in silently.
3. **Pasted**: read back in words ("Jira Cloud · unity3d.atlassian.net · project VCS") by `recognizeTrackerLink`,
   with nothing sent. A link that isn't an issue says what it is and what to paste instead.
4. **Sign in**: when the kind and server have a connection already, "Use Jira at unity3d.atlassian.net · signed in as
   Daniel Peñalba" binds it at once (frame 8). Otherwise the sign-in method's own step (below).
5. **Proof**: "Signed in as Daniel Peñalba" and "Project VCS · 214 open issues, 6 assigned to you"
   (`projectAccess`). The pasted issue isn't shown back: it was a sample. Sign-in works but the project can't be read:
   the message names the project.
6. **Done**: the section shows the repository's tracker, project and account, with Change (paste another link) and
   Disconnect (this repository), plus "Add a project" by another link.

The words for each failure: "That's a link to a Jira board, not an issue. Open any issue and copy its address.",
"Jira didn't accept this token for daniel@example.com. Check the email, or create a new token.", "Jira couldn't be
reached at unity3d.atlassian.net."

Left out until a feature uses them: the naming step (frame 6) and the "412 branches are linked" summary (frame 7's
list). Their place is the binding (above) and step 6.

## Sign-in

`TrackerSignIn` is each provider's method, a union that grows: `{ kind: 'token', … }` today, `{ kind: 'browser', … }`
when the trackers' app registrations exist. Everything after it (the connection, `whoAmI`, the proof) is the same for
any method.

**Token**, for every tracker today. "Create a token" opens the tracker's page in the browser, filled in where it
allows it; the user copies the token there and presses **Paste token**: main reads it from the clipboard
(`clipboard.readText`), checks its shape, signs in with it and keeps it. The token never enters the renderer, so it
never crosses IPC at all. A field would be the usual way, but its text would cross from the page to main and live in
the renderer's memory; a password manager filling it is the one thing lost, rare for tokens made a moment before.

| Tracker | Token page | Read access asked | Sent as |
| --- | --- | --- | --- |
| Jira Cloud | `https://id.atlassian.com/manage-profile/security/api-tokens` (nothing to fill in) | a classic token, or one scoped `read:jira-work`, `read:jira-user` | Basic, the account's email and the token. A scoped token works only through `https://api.atlassian.com/ex/jira/<cloudId>` (the cloud id from the site's `/_edge/tenant_info`): sign-in tries the site, then the gateway, and keeps what worked (`apiBase`) |
| Jira Data Center | `<server>/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens` | a personal access token (it has the user's own permissions) | Bearer |
| GitHub, GitHub Enterprise Server | `<server>/settings/personal-access-tokens/new?name=UVCS+Desktop&target_name=<owner>&issues=read` (fine-grained, filled in) | Issues: read (and Metadata: read, always given) | Bearer; the API at `api.github.com`, or `<server>/api/v3` and `/api/graphql` |
| GitLab | `<server>/-/user_settings/personal_access_tokens?name=UVCS+Desktop&scopes=read_api` | `read_api` | Bearer |
| Linear | `https://linear.app/settings/account/security` | a personal API key with Read only | The key alone in `Authorization` (no Bearer) |

**Asking for more later**: a connection records the access it asked for (`access: 'read'`). A feature that needs to
write (move, assign) asks `ensureAccess(connection, 'write')`, which opens the same sign-in step with the wider access
when the connection's is narrower, and a tracker refusing a write as `noAccess` leads there too. A token's real scopes
can't always be read back (GitHub's fine-grained tokens don't say), so the refusal is the proof.

**Browser sign-in, when it comes**, needs per tracker:

- **GitHub** (github.com): an OAuth app or a GitHub App registered by Unity with the device flow enabled (no client
  secret in the app); a GitHub App gives `Issues: read` alone, but must be installed on each organization. Enterprise
  Server: an app registered on each server by its admin, so tokens stay its default.
- **GitLab** (gitlab.com): a non-confidential OAuth application with PKCE or the device grant, scope `read_api`.
  Self-hosted: an application per instance, by its admin; tokens stay its default.
- **Linear**: an OAuth app with PKCE (no secret), scope `read`, a redirect to the app.
- **Jira Cloud**: an OAuth 2.0 (3LO) app in Atlassian's developer console (`read:jira-work`, `read:jira-user`,
  `offline_access`), and a small stateless token service Unity hosts, since Atlassian's code exchange and refresh need
  the client secret (no PKCE on Cloud). Jira Data Center: an incoming application link made by each site's admin
  (PKCE works there); tokens stay its default.
- For all: a redirect back to the app (`uvcs://` is registered already, docs/features/deep-links.md, or a loopback
  address), and refresh tokens kept in `TrackerSecrets` like any credential.

## Economy

The trackers' servers get the care `cm`'s does (CLAUDE.md "Every `cm` command earns its place"):

- One request for every issue on screen (`IssueReadBatch`, the providers' batch reads); never one per issue.
- Read on a settled selection, a card opened, a `#` typed, or a focus once stale; never on a timer.
- Cached five minutes; a missing issue too.
- Connect costs two or three requests (`whoAmI`, `projectAccess`), only when asked.
- Rate limited or failing, the origin rests (`TrackerCooldown`) and chips stay links; nothing blocks and nothing
  retries in a loop.

Trackers are a new place data leaves the device: ARCHITECTURE.md "What leaves the device" names them once built, and
the pull request flags it.

## Adding a tracker

1. Its kind in `IssueTrackerKind`.
2. Its grammar (`shared/issueTrackers/grammars/<kind>.ts`): `recognize`, `referencesIn`, `issueUrl`, `tokenPageUrl`,
   `capabilities`, tested with its real link shapes.
3. Its provider (`main/issueTrackers/providers/<kind>.ts`), its JSON parsers beside it, tested with
   `fakeTrackerHttp` and responses recorded from the tracker.
4. Its words and icon (`trackerWords`, `TrackerIcon`), and its row in the tables above.

The registries' `Record`s fail to compile until 2 and 3 exist.

## Adding a capability

A method on `IssueTrackerProvider` (and on `IssueTrackersApi` for the renderer), built for every tracker with its
fixtures, or listed outside a tracker's `capabilities` where the tracker can't. Writes ask `ensureAccess('write')` first
and refresh the issues they change (their query keys), as operations declare what they affect.

## Considered and dropped

- **A link stored by the app** (an issue per branch in its own store, as integrations often do): every machine would
  need it and no other client would see it. The text already holds the link.
- **Recognizing any `ABC-123`**: `UTF-8`, `ISO-8859`, `SHA-256` would become issues. Only the bound projects' keys.
- **Connections in `settings.json`**: the renderer writes settings whole, so it could point a connection's token at
  another server. Their own store, changed only by typed methods.
- **The token in a field**: it would cross IPC and live in the renderer. Read from the clipboard by main.
- **A generic `fetch` for the renderer**, or the renderer calling trackers itself: the renderer is untrusted and its
  Content-Security-Policy allows no connection out. Typed methods in main only.
- **One read per chip**: a comment with fifty keys would be fifty requests. Batched per task.
- **Keying bindings by the repository's GUID**: one more server command per window for a rare rename. The spec, moved
  on the app's own renames.
- **A setup screen of parameters per tracker** (user, password, host, branch prefix, a working mode), as older
  integrations have: the link holds the setup, and the sign-in is the only thing asked.
- **One tracker per repository is the rule for now**; the binding's `projects` take several projects of that tracker.
