# About, updates and releases

## The About dialog

The brand at the start of the top bar (`AppBrand`: the mark and the name, after the window's buttons) opens it, as do
the app menu (macOS), Help (Windows, Linux) and the palette (`app.about`). It shows the version, where the update
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
(`updates.status`).

- **When**: once 4 s after launch, so it never competes with the first window's reads, then every hour
  (`FIRST_CHECK_DELAY_MS`, `CHECK_INTERVAL_MS`), and when the user asks (`check`: the About dialog, Check for
  Updates… in the menus, the palette). It asks GitHub, never the UVCS server: the one timer besides the incoming check.
  Development builds have no feed: they never check, and say so when asked (`unavailable`).
- **Download**: an update found downloads by itself, then waits (`ready`). A check while one is under way or ready
  checks nothing and tells where it stands.
- **Install**: "Restart & Install" quits into it (Windows runs the installer silently, per user, and starts the app
  again); quitting the app installs it too (`autoInstallOnAppQuit`).
- **Unsigned macOS builds**: Squirrel.Mac, which electron-updater installs through on macOS, rejects any build without a
  Developer ID signature ("code failed to satisfy specified code requirement(s)"). Once an update is found,
  `needsManualInstall` asks `codesign` about the running bundle (its one process: `noExternalUi.test.ts` allows it); such
  a build downloads the release's disk image itself instead (`downloadInstaller`: through Electron's `net`, which takes
  the system's proxy, into Downloads, checked against the release's sha512, kept across restarts when whole), then
  offers "Open Installer": it opens the image and quits, and the user drags the app to Applications. The image is picked
  by architecture (`installerAsset`: `latest-mac.yml` lists both, x64 first), and an x64 build under Rosetta moves to
  arm64. Signing the build (the release workflow's secrets) switches it to restart-to-install with no code change.
- **Failures** read as one sentence (`describeUpdateError`): electron-updater reports an HTTP failure as the whole
  response, `Set-Cookie` tokens included, which never reaches the screen.

The renderer (`app/updates/`): `updateStore` keeps the status. The corner card (`UpdateCard`, stacked with the toasts)
shows a download with its percent, then the ready update until "Later" puts that version off (`updateCardOf`); a newer
one shows again. A check the window asked for answers in one toast, "Checking…" turning into the answer
(`checkFeedback`), unless the About dialog is open, which shows the same; the app's own checks say nothing.

## What's New

Each release's notes are its description on GitHub. electron-updater reads them from the releases feed with the check
that finds an update (`fullChangelog`, set in `createAppUpdates`: every release between the running version and the
update, not just the latest), so they cost no request of their own. `AppUpdates` keeps them (`releaseNotesOf` leaves
out releases with none) and the renderer asks for them once per version (`updates.releaseNotes`,
`releaseNotesQuery`).

While an update downloads or waits to install, "What's New" on the update card and in the About dialog opens a dialog
(`ReleaseNotesDialog`) with each release's notes, newest first, headed by version when the update skips a few
(`releaseNotesSections`), and the install button once the update is ready. With no notes, there is no button. GitHub's
generated notes open with a "What's Changed" heading, which the title already says, so it is left out; their closing
"**Full Changelog**" link becomes a quiet "Full changelog" line under the release (`changelogUrl`). While About or What's
New is open the update card steps aside (`updateCardOf`): it would repeat them, over the dialog's own buttons.

GitHub sends the notes as HTML. `releaseNotesFromHtml` reads it into the tree `MarkdownBlocks` renders, so no HTML
from the feed ever reaches the page: headings, paragraphs, lists (nested ones join their parent), quotes, code,
emphasis and `http(s)` links, which open in the browser; a nested list stays under its item (`MarkdownListItem.sublist`); images, scripts, styles and any other address are left out.
Showing the HTML as it comes (`dangerouslySetInnerHTML`) was rejected: the renderer is untrusted and must never run
markup from the network.


- The **Release** workflow (`.github/workflows/release.yml`, run by hand with a bump: patch, minor or major) owns the
  version: it bumps `package.json`, tags `v<version>` on main, opens a draft release with generated notes, and builds
  every OS's installers onto it (`npm run release`). The draft's description is what What's New shows: edit it before
  publishing. Publishing the draft makes the update reach every running app
  within the hour. Never bump the version by hand.
- The installers (electron-builder.yml) are one per OS and architecture, named without spaces
  (`UnityVersionControl-<version>-macOS-arm64.dmg`: GitHub turns spaces into dots, which `latest*.yml` would no longer
  match); macOS ships a zip too, which electron-updater needs.
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
  `scripts/build/`, one plugin for main, preload, renderer and its workers; the text is `thirdPartyNotices`).
  electron-builder.yml's `extraResources` ships it with the app's `LICENSE.md` and `NOTICE` as plain files in the
  resources folder, outside `app.asar`.
- **Licenses**: the app is Apache-2.0 (`LICENSE.md`, `NOTICE`), and every package in package-lock.json must have a
  permissive license (`PERMISSIVE_LICENSES`, `scripts/build/dependencyLicenses.test.ts`): a copyleft one fails the tests
  and needs a legal decision before it joins.
- macOS signing and notarization turn on once the `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` secrets exist; without them the build is signed ad hoc (the
  workflow's `MAC_SIGNING_FLAGS`), opens after Privacy & Security ▸ Open Anyway, and updates by its disk image. A build
  with no signature at all is rejected: macOS on Apple silicon calls it "damaged", because electron-builder's edits to
  the bundle break Electron's own signature. Windows builds are unsigned: electron-updater checks an installer's publisher only when the app names one.
- The feed must be readable without signing in, so the releases' repository is public: electron-updater reads a private
  repository's releases only with a token, which the app never ships. With no published release (only a draft), a
  check says "No published release is available to update from yet."

## CI

`.github/workflows/ci.yml` runs on every push to main and every pull request: the tests and the build on macOS
arm64, Windows x64 and arm64 and Linux x64, the typecheck once on Linux, and the smoke test (`npm run e2e`) inside the
macOS and Windows x64 jobs. The shared install step (`.github/actions/install`) pins Node, restores `node_modules` from
the last install of the same lockfile (`reuse-node-modules`, CI only: releases install clean), or else caches npm's and
Electron's downloads and retries `npm ci`. On a Windows runner with a raw local SSD (arm64) the job formats it as a Dev
Drive and builds there (`BUILD_DIR`). How fast the tests run on CI's 2-CPU runners, and why: `vitest.config.ts`.

`.github/workflows/codeql.yml` runs GitHub's CodeQL security analysis on pushes to main, pull requests and weekly;
findings show in the Security tab and on pull requests. It skips while the repository is private: code scanning needs
GitHub Advanced Security there, and is free on a public repository.

Every action a workflow uses is pinned to a full commit SHA, its tag in a comment (Unity's SSDLC: a tag can be
moved to other code), which `scripts/build/pinnedActions.test.ts` checks; Dependabot (`.github/dependabot.yml`) proposes
the new commits monthly.
