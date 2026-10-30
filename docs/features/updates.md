# About, updates and releases

## The About dialog

The version at the end of a workspace's status bar (`StatusBarVersion`) opens it, as do the app menu (macOS), Help
(Windows, Linux) and the palette (`app.about`). Once an update is downloaded the version reads "Update ready", in the
accent, until the app restarts into it (`versionItem`): the corner card can be put off, this quiet reminder stays. It shows the version, where the update
stands with its one button (Check for Updates, or install once one is ready: `aboutUpdateLine`, `aboutUpdateAction`),
and what the app runs on: the `cm` found (`cmVersionQuery`, asked once at start: no command of its own), the OS and
architecture, Electron and Chromium. Copy Details copies those as text for an issue (`aboutDetails`); its other links
open the documentation, a bug report with those details filled in (`aboutBugReportUrl`), a feature request
(`featureRequestUrl`) and the third-party notices (`openThirdPartyNotices`, at `thirdPartyNoticesPath`). With every window closed on
macOS, About shows the OS's panel instead (`showAboutPanel`), which reads the bundle.

## Reporting an issue

Issues open on GitHub's issue forms (`.github/ISSUE_TEMPLATE/`): a bug report (what happened, what was expected, the
steps, the app details, and optional logs or error details) and a feature request (the problem, the idea, other
options). Blank issues are off, and `config.yml` sends security reports to the private advisory form (SECURITY.md).
The app opens a form through its address, prefilling fields by their `id` (`issueFormUrl`, `shared/issueForms.ts`:
`BUG_REPORT_FORM` and `FEATURE_REQUEST_FORM` name the forms and the ids the app fills, which `issueForms.test.ts`
checks against the YAML). Help ▸ Report an Issue and Request a Feature open the empty forms (`BUG_REPORT_URL`,
`FEATURE_REQUEST_URL`); About fills in the app details.

The error dialog (`ErrorDialog`, from an error toast's Details) has Report an Issue next to Show in command log: the
bug report titled with what failed, with the app details and the error as its Copy button gives it (`errorIssueUrl`,
`errorReport`). Nothing is sent: the user reads, edits and sends the form in the browser, so paths in the command stay
theirs to remove. The error's secrets were hidden in main before it reached the window (`hideSecrets`, ARCHITECTURE.md
"Secrets"). The address stays under `MAX_ISSUE_URL_LENGTH` (6,000 characters; GitHub rejects much over 8 KB): the title
keeps its first line, at most `MAX_ISSUE_TITLE_LENGTH` characters, and a field that doesn't fit is cut at a whole
character and ends with `CUT_SHORT_MARK`.

## How the app updates

The app updates from the GitHub releases of `RELEASES_REPOSITORY` (`main/update/releaseFeed.ts`; electron-builder.yml's
`publish` names the same one, which a test checks), through electron-updater. `AppUpdates` (`main/update/`) owns it and
tells every window each step (`updateStatusChanged`, an `UpdateStatus`); a window that opens reads where it stands
(`updates.status`). electron-updater loads at the first check (`loadFeed`, a chunk of its own): it is half the main
bundle, and the main module evaluates it in about 7 ms that the first window would otherwise wait for.

- **When**: once 4 s after launch, so it never competes with the first window's reads, then every hour
  (`FIRST_CHECK_DELAY_MS`, `CHECK_INTERVAL_MS`), and when the user asks (`check`: the About dialog, Check for
  Updates… in the menus, the palette). It asks GitHub, never the UVCS server: the one timer besides the incoming check.
  Development builds have no feed: they never check, and say so when asked (`unavailable`).
- **What a check sends**: a standard web request, so GitHub sees the IP address and the user agent, and nothing that
  identifies the installation. electron-updater would give each installation a random id (`.updaterId` in the user
  data folder) and send it as `x-user-staging-id` with every check, only to serve staged rollouts (a release's
  `stagingPercentage`); `withoutStagingUserId` (applied in `createAppUpdates`) drops the header, never creates the
  file, and offers every release to everyone; `removeLeftoverStagingUserId` deletes, at start, the file an earlier
  version left. The releases never stage, so nothing is lost; a staged rollout would need
  another way to pick its users. Downloads send no id either, the unsigned-macOS installer's included
  (`downloadInstaller` fetches the bare URL).
- **Download**: an update found downloads by itself, then waits (`ready`). A check while one is under way or ready
  checks nothing and tells where it stands.
- **Install**: "Restart & Install" quits into it (Windows runs the installer silently, per user, and starts the app
  again); quitting the app installs it too (`autoInstallOnAppQuit`). Asked while an operation changes a workspace
  (`writesRunning`: an update, a checkin…), it waits for it to finish (`waitingToInstall`: the card and About say so,
  with nothing to press) rather than kill its `cm` partway; quitting asks the same. The app comes back with every
  window where it was, each on the view it showed (`beforeRestart`; ARCHITECTURE.md "Windows").
- **Unsigned macOS builds**: Squirrel.Mac, which electron-updater installs through on macOS, rejects any build without a
  Developer ID signature ("code failed to satisfy specified code requirement(s)"). Once an update is found,
  `needsManualInstall` asks `codesign` about the running bundle (its one process: `noExternalUi.test.ts` allows it); such
  a build downloads the release's disk image itself instead (`downloadInstaller`: through Electron's `net`, which takes
  the system's proxy, into Downloads, checked against the release's sha512, kept across restarts when whole), then
  offers "Open Installer": it opens the image and quits, and the user drags the app to Applications. The image is picked
  by architecture (`installerAsset`: `latest-mac.yml` lists both, x64 first), and an x64 build under Rosetta moves to
  arm64. Releases are signed (see the releases below), so this path serves only a build made without a Developer ID.
- **Failures** read as one sentence (`describeUpdateError`): offline, no published release, the app's own failures as
  worded (`UpdateFailure`: no installer for this Mac, a damaged download), and for anything else "GitHub didn't answer as
  expected", which the next check usually passes (a release just published, a rate limit, an outage). electron-updater's
  own messages never reach the screen: wrapped two or three times, they hold the whole response, `Set-Cookie` tokens
  included, and the releases feed. The cause goes to the console instead (`[updates]`, `updateErrorForLog`: the cause
  chain, cut before the headers and the feed), and only the cause is matched, so no word in a release's notes counts.

The renderer (`app/updates/`): `updateStore` keeps the status. The corner card (`UpdateCard`, stacked with the toasts)
shows a download with its percent, then the ready update until "Later" puts that version off (`updateCardOf`); a newer
one shows again. A check the window asked for answers in one toast, "Checking…" turning into the answer
(`checkFeedback`), unless the About dialog is open, which shows the same; the app's own checks say nothing.

## What's New

What users read there is written with each change: every pull request's body has a `## Release note` section, one
note (`### New:`, `Improved:` or `Fixed:`, a title, then a short Markdown description) or `None:` and why users have
nothing to read. The `release-notes` skill (`.claude/skills/release-notes`) says how to write one: for users, not
reviewers, in the app's words. The Release note workflow (`.github/workflows/release-note.yml`) reads the section with
`readReleaseNote` (`scripts/build/releaseNote.ts`) on every change to the pull request and fails it when it can't;
Dependabot's pull requests are left out. It runs apart from CI so that editing the description checks the note again
without building on every OS.

The Release workflow joins those notes into the release's description (`releaseNotesMarkdown`,
`scripts/build/releaseNotes.ts`): `## New`, `## Improved` and `## Fixed`, each note an `###` title and its
description, in the order the pull requests merged, then `## Other changes` listing by title the pull requests without
a note it can read (those merged before notes were asked for), and the "**Full Changelog**" link. Notes that say
`None:` and Dependabot's pull requests are left out. GitHub renders that Markdown on the releases page, and the app
reads it from the feed for What's New.

Each release's notes are its description on GitHub. electron-updater reads them from the releases feed with the check
that finds an update (`fullChangelog`, set in `createAppUpdates`: every release between the running version and the
update, not just the latest), so they cost no request of their own. `AppUpdates` keeps them (`releaseNotesOf` leaves
out releases with none) and the renderer asks for them once per version (`updates.releaseNotes`,
`releaseNotesQuery`). The update's own release carries the date it was released (`ReleaseNotes.releaseDate`, from
electron-updater's `UpdateInfo.releaseDate`, which its `latest*.yml` holds); the feed dates no other release, and none
is asked for.

While an update downloads or waits to install, "What's New" on the update card and in the About dialog opens a dialog
(`ReleaseNotesDialog`) that reads like a product's release notes. With nothing to show there is no button
(`hasWhatsNew`, `useHasWhatsNew`, which ask the dialog's own `releaseSections`): GitHub's notes can hold only their
"Full Changelog" line or new contributors, both left out. Should the dialog still open without anything, it says so
in one quiet line, "All releases" still in its footer (`whatsNewBody`'s `empty`). While About or What's New is open
the update card steps aside (`updateCardOf`): it would repeat them, over the dialog's own buttons.

- **Header**: the app's mark, "What's new in <version>", and under it the version running (`appInfoQuery`) and the
  day the update was released (`whatsNewSubtitle`).
- **Notes** (`whatsNewRelease`): a release written as the Release workflow writes it has groups under level-2
  headings named exactly New, Improved, Fixed and Other changes (`NOTE_KIND_LABELS`); each note in them is a level-3
  heading, its title, and everything up to the next h2 or h3 is its description, rendered as full Markdown: smaller
  headings (a step below the note's title), pictures, tables, code and lists. A list in a group is a note per item;
  an unknown group is one other change titled by its heading; what comes before the first group is the release's
  introduction. GitHub's generated notes ("What's Changed", the releases already published) read as other changes, a
  note per pull request, its title without the "by @user in #12" it ends with (`withoutAuthorTail`); their "New
  Contributors" are left out. Notes written any other way show as plain Markdown (`WhatsNewRelease.plain`). The
  closing "**Full Changelog**" line is left out: the footer links to every release instead.
- **Filter** (`filterSegments`): the app's segmented control (`SegmentedControl`), as its other views pick what they
  show: All and each kind the notes hold, with how many notes each has across every release the update spans, shown
  only when the notes hold more than one kind. A kind with no notes has no segment.
- **Releases** (`releaseSections`): the update's own release is open under the title; each older one is a row ("0.2.3
  · 6 notes") the user unfolds (`toggledRelease`). A release with nothing to show is left out; when that's the
  update's own, the first release shown opens in its place, named by its row. Each group is titled as the app titles
  a section (`SectionTitle`, as Home's "Recent"): its name, small and uppercase, and how many notes it holds; no color
  of its own. A
  filter shows its kind from every release at once, each older release named by its row (no longer a toggle), so
  "Fixed" lists every fix since the running version; releases with none of that kind are left out, and so is what a
  release says outside its notes. Going back to All keeps the releases the user had unfolded.
- **Footer**: "All releases", the repository's releases page (`AppInfo.releasesUrl`), and "Later" with the install
  button once the update is ready (`installLabel`), or just "Close".

GitHub sends the notes as HTML. `releaseNotesOutline` reads it into the tree `MarkdownBlocks` renders, so no HTML
from the feed ever reaches the page, cut at its h2 and h3 headings (a heading in GitHub's `markdown-heading` box
too): cutting the HTML rather than the blocks keeps a description's h4 to h6 inside its note, as `MarkdownBlock` reads
h3 to h6 as one level. It keeps headings, paragraphs, lists (a nested list stays under its item,
`MarkdownListItem.sublist`), quotes, code, tables (GitHub's `<markdown-accessiblity-table>` box and its columns'
`align`), emphasis, `http(s)` links, which open in the browser, and `http(s)` pictures. A picture in a link comes out
beside it, after the link's text (a link inside a link isn't HTML), so the link GitHub wraps each picture in reads as
the picture alone. Scripts, styles, attributes other than the few it reads, and links and pictures to any other
address are left out. The feed gives a picture uploaded to GitHub as a `private-user-images.githubusercontent.com`
address whose token expires five minutes after the feed is read, long before What's New opens, so it is read as the
attachment's lasting address, `https://github.com/user-attachments/assets/<id>` (`lastingPictureUrl`).

What's New shows the pictures themselves (`MarkdownBlocks` with `images="inline"`, `InlinePicture`): as wide as the
note at most and never wider than they are, at their own proportions, framed by a subtle border, opening at full size
in the browser on a click. While one loads it holds a quiet place of a stable height; one that can't load falls back
to the chip comments show (`inlinePictureView`), so its description and link stay. Comments keep their chips
(`CommentImage`, fetched only on hover): anyone may link anything there. Showing the HTML as it comes
(`dangerouslySetInnerHTML`) was rejected: the renderer is untrusted and must never run markup from the network.

**Seeing it while developing**: an unpackaged app has no feed, so What's New never opens. `UVCS_PREVIEW_UPDATE=<file>`
(`previewUpdateFile`, `previewUpdateFeed`; ignored by a packaged app, and when blank) makes it find the update a JSON
file describes, ready at once and never installed (installing it only logs a warning, and quitting stays a plain quit): `{ "version", "releaseDate", "releaseNotes": [{ "version", "note" }] }`, each note the HTML GitHub
renders (`gh api repos/<owner>/<repo>/releases/latest -H "Accept: application/vnd.github.html+json" --jq .body_html`,
or `gh api markdown -f mode=gfm -F text=@notes.md` for notes not published yet). Start it with `npm run app:debug`; the
update card shows after the first check, `FIRST_CHECK_DELAY_MS` after launch.


- The **Release** workflow (`.github/workflows/release.yml`, run by hand with a bump: patch, minor or major) owns
  the version: it bumps the last release tag's version, commits it on top of main and pushes only the tag
  `v<version>` (main is protected, so the bump never lands there and main's `package.json` keeps an older version),
  opens a draft release with the pull requests' release notes (see "What's New"), and builds every OS's installers
  onto it (`npm run release`). Linux builds in it; macOS and Windows build and sign in a private repository,
  [uvcs-desktop-client-release-signing](https://github.com/Unity-Technologies/uvcs-desktop-client-release-signing),
  whose Sign workflow (`sign-release.yml`) the Release run starts for the tag and waits for (its `sign` job, through
  `SIGNING_REPO_TOKEN`, which may only start and read that repository's workflows). Unity's signing certificates are
  in Azure Key Vault, which accepts only Unity's networks, and Unity's runners that reach it may serve only private
  repositories (SSDLC), which this one isn't. The Sign workflow builds this repository's tag with this repository's
  config and sign hook, and uploads to the same draft; its README lists its secrets. This repository holds no
  signing secret. The draft's description is what What's New shows: edit it before publishing. Its pull requests are
  those whose merge commits ("Merge pull request #N from <owner>/…", which needs the merge method and its default
  message) are on main since the last release tag, not GitHub's pick: GitHub starts from the newest tag in the new
  tag's history, and no release tag is there (its bump commit never reaches main), so the notes would repeat every
  earlier release's changes. Publishing the draft makes the update reach every running app within the hour. Never
  bump the version by hand.
- The installers (electron-builder.yml) are one per OS and architecture, named without spaces
  (`UnityVersionControl-<version>-macOS-arm64.dmg`: GitHub turns spaces into dots, which `latest*.yml` would no longer
  match); macOS ships a zip too, which electron-updater needs. The macOS targets name no architecture, so a run builds
  the ones its command line names (`--x64`, `--arm64`; a local `npm run dist` builds only the Mac's own): releases
  build each in its own run, at once, so Apple notarizes both apps at the same time (about 3 minutes each, the
  slowest step of a release), and join the two runs' `latest-mac.yml` into one (`mergeMacUpdateInfo`,
  `scripts/build/mergeMacUpdateInfo.ts`: the x64 zip stays the default download; electron-updater and
  `installerAsset` pick their architecture's files by name, in any order). Listing the architectures in the targets,
  as one run building both did, was rejected: the command line can't narrow them.
- **Windows installer**: the NSIS installers (one per architecture, and `UnityVersionControl-<version>-Windows.exe`
  holding both, which `latest.yml` points updates at) unpack the app from a 7z archive with electron-builder's
  `nsis7z` plugin, 7-Zip 19.00. electron-builder's own 7-Zip is newer and packs ARM64 executables with the ARM64
  filter (7-Zip 23), which that plugin can't decode: the installer then writes every file but the app's .exe and DLLs,
  and its shortcut asks where `Unity Version Control.exe` went. electron-builder.yml's `beforePack` hook
  (`scripts/build/windowsInstallerFilter.ts`) forces the BCJ filter instead (`ELECTRON_BUILDER_7Z_FILTER`) on every
  Windows build, at about 8% more size. It lives in the config, not a workflow, because the release builds in the
  signing repository and a local `npm run dist` needs it too. Building arm64 alone with it was rejected: the combined
  installer the updater downloads holds the arm64 archive too. Drop it once electron-builder's nsis-resources ship an
  `nsis7z` that reads the ARM64 filter.
- The **app icon** is the mark the About dialog draws (`APP_MARK`, `shared/appMark.ts`, which `AppMark` renders in the
  theme's colors), in the light theme's colors (`APP_ICON_COLORS`, checked against `tokens.css`). `npm run icons`
  (`scripts/icons/makeAppIcons.mjs`) makes the committed files in `build/` from `appIconSvg`, drawing each size from
  the vectors with the installed Electron's Chromium (`rasterize.cjs`) and writing the .icns and .ico itself, so it
  needs no other tool: `icon.icns` (macOS, 16 to 1024 pixels, the tile on Apple's icon grid: 824 of 1024 pixels, so
  the Dock shows it the size of other apps), `icon.ico` (Windows, 16 to 256, edge to edge), `icons/256x256.png` and
  `512x512.png` (Linux), and `icon-macOS.svg`/`icon.svg`, the sources. electron-builder.yml names them per OS; the disk
  image and the Windows installer show them too. Running unpackaged, the app sets the Dock's icon itself
  (`DEVELOPMENT_DOCK_ICON`, `build/icon-macOS.png`), and a window takes the PNG where the OS reads it from the window
  (`windowIcon`: Linux, and Windows while unpackaged). `appIconFiles.test.ts` fails when the mark changes until
  `npm run icons` runs again.
- **Third-party notices**: the build minifies every library into `out/`, which drops the license headers MIT, BSD, ISC
  and Apache ask to keep, so `npm run build` also writes `out/THIRD_PARTY_NOTICES.txt`: the name, version, license
  and LICENSE/NOTICE files of exactly the packages whose code is in the bundles (`thirdPartyNoticesCollector` in
  `scripts/build/`, one plugin for main, preload, renderer and its workers; the text is `thirdPartyNotices`). Every
  package's entry carries a full license text: a package whose npm package ships no license file gets the text in
  `SUPPLIED_LICENSES` (`scripts/build/suppliedLicenses.ts`, one reviewed file per package in
  `scripts/build/suppliedLicenses/`, copied from its upstream repository, or the standard text of the license its
  package.json names with its author when upstream has none either), and `npm run build` fails on a bundled package with
  neither, or whose supplied text is for another license than the one it names. A new dependency that fails it gets its
  upstream license text added there; an entry whose package now ships its own license file fails
  `suppliedLicenses.test.ts` until it is removed. electron-builder.yml's `extraResources` ships
  `THIRD_PARTY_NOTICES.txt` with the app's `LICENSE.md` as plain files in the resources folder, outside `app.asar`.
- **Licenses**: the app is made available under the Unity Terms of Service (`LICENSE.md`, which also holds the
  copyright line; package.json says `SEE LICENSE IN LICENSE.md`). Every package in package-lock.json must have a
  permissive license (`PERMISSIVE_LICENSES`, `scripts/build/dependencyLicenses.test.ts`): a copyleft one fails the
  tests and doesn't join.
- **macOS** releases are signed with Unity's Developer ID (`Unity Technologies SF (9QW8UQUTAA)`, the certificate Unity
  Hub uses, imported from Key Vault on Unity's macOS runners) and notarized, so updates install on a restart. macOS
  installs an update only from the same team, so that identity must never change. A local build (`npm run dist`) is
  signed with whatever Developer ID the keychain holds; `-c.mac.identity=- -c.mac.hardenedRuntime=false` signs it ad
  hoc instead, so it opens after Privacy & Security ▸ Open Anyway and updates by its disk image. A build with no
  signature at all is rejected: macOS on Apple silicon calls it "damaged", because electron-builder's edits to the
  bundle break Electron's own signature. The hardened runtime, which only notarization needs, must be off under an
  ad-hoc signature: it refuses Electron's frameworks (library validation).
- **Windows** releases build with `electron-builder.windows-signed.yml`, whose sign hook (`signWindowsFile`,
  `scripts/build/signWindows.ts`) signs every .exe (the app, `elevate.exe`, the installers and their uninstallers) with
  Unity's EV certificate in Key Vault through jsign, SHA-256 and timestamped; the hook reads the vault, the
  certificate, an access token and the jsign jar from `AZURE_SIGNING_VARIABLES`. jsign runs on any OS, so releases
  build the Windows installers on Unity's macOS runners: Unity's Windows runners scan every file they write
  (Defender, which a job can't turn off), and installing and building took them about 9 minutes against 2. The
  installers are the same as Windows would build: the same Electron binaries, NSIS, 7-Zip and filter, resedit for the
  .exe's resources, and a standard Authenticode signature. That holds because the app has no native Node modules
  (`npmRebuild: false`, everything bundled by electron-vite): one would have to be compiled for Windows on Windows. A build
  with electron-builder.yml alone (`npm run dist`) is unsigned, and SmartScreen warns of an unknown publisher. The
  signed build writes its `publisherName` into the app's `app-update.yml`, and from then on electron-updater installs
  only an update whose valid signature names that publisher (`verifySignature`). So before uploading, the release
  installs every installer on real Windows, x64 and arm64 (each architecture's own, then the combined one the updater
  downloads), checks each put the app's .exe where it belongs (the arm64 one once didn't: "Windows installer"), and
  checks every .exe the way the updater will (`verifyWindowsSignatures.ts`; `signatureProblem` reads the signer as
  `parseDn` does). A wrong name, a broken signature or a missing exe fails the release instead of reaching users.
  Every
  release after a signed one must be signed by the same name: an unsigned one, or a renewed certificate with another
  common name, never reaches those apps. An unsigned build names no publisher and checks nothing.
- Signing on GitHub's own runners was tried and rejected: Key Vault answers 403 ("Client address is not authorized"),
  and its client secret rotates every 7 days, so it can't live in a GitHub secret either.
- The feed must be readable without signing in, so the releases' repository is public: electron-updater reads a private
  repository's releases only with a token, which the app never ships. With no published release (only a draft), a
  check says "No published release is available to update from yet."

## CI

A pull request joins main through GitHub's merge queue (`gh pr merge --auto --merge`, or "Merge when ready"): once
its own CI passes, the queue builds a merge commit of main, the pull requests queued ahead of it and this one, runs the
required checks (the four `ci.yml` jobs, and the Release note check, which skips itself there: it read the pull
request's note already) on it, and merges it only if they pass; if they fail, the pull request leaves
the queue and main is untouched. So no one updates a branch by hand, and main always passes. Each pull request runs CI
twice, on its own and in the queue: at about 4 minutes a run, splitting a lighter pull-request CI from a full queue
CI was rejected as not worth it. `scripts/build/mergeQueueTrigger.test.ts` keeps the `merge_group` trigger of both workflows,
without which nothing merges.

`.github/workflows/ci.yml` runs on every push to main, every pull request and every merge-queue entry: the tests and the build on macOS
arm64, Windows x64 and arm64 and Linux x64, the typecheck once on Linux, and the smoke test (`npm run e2e`) inside the
macOS and Windows x64 jobs. The shared install step (`.github/actions/install`) pins Node, restores `node_modules` from
the last install of the same lockfile (`reuse-node-modules`, CI only: releases install clean), or else caches npm's and
Electron's downloads and retries `npm ci`. On a Windows runner with a raw local SSD (arm64) the job formats it as a Dev
Drive and builds there (`BUILD_DIR`). On macOS the temp folder is a disk in memory: the runner's own disk now and
then holds writes for seconds, which timed out tests writing a temp file. How fast the tests run on CI's 2-CPU
runners, and why: `vitest.config.ts`.

CI's runners are slow and uneven: a test runs up to ten times slower there than on a laptop, and several times slower
again on a bad day (a word-marks test of 0.6 s locally once took 10 s on Windows x64), against vitest's 5 s timeout.
Tests that took 2 to 4 s there timed out now and then, whichever was running when the runner slowed down; that is why
a test takes milliseconds (CLAUDE.md "Super fast").

`.github/workflows/codeql.yml` runs GitHub's CodeQL security analysis on pushes to main, pull requests and weekly;
findings show in the Security tab and on pull requests. It skips while the repository is private: code scanning needs
GitHub Advanced Security there, and is free on a public repository.

Every action a workflow uses is pinned to a full commit SHA, its tag in a comment (Unity's SSDLC: a tag can be
moved to other code), which `scripts/build/pinnedActions.test.ts` checks; Dependabot (`.github/dependabot.yml`) proposes
the new commits monthly.
