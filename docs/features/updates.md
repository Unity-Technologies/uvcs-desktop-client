# About, updates and releases

## The About dialog

The brand at the start of the top bar (`AppBrand`: the mark and the name, after the window's buttons) opens it, as do
the app menu (macOS), Help (Windows, Linux) and the palette (`app.about`). It shows the version, where the update
stands with its one button (Check for Updates, or install once one is ready: `aboutUpdateLine`, `aboutUpdateAction`),
and what the app runs on: the `cm` found (`cmVersionQuery`, asked once at start: no command of its own), the OS and
architecture, Electron and Chromium. Copy Details copies those as text for an issue (`aboutDetails`); its other links
open the documentation and a new issue. With every window closed on
macOS, About shows the OS's panel instead (`showAboutPanel`), which reads the bundle.

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

## Releases

- The **Release** workflow (`.github/workflows/release.yml`, run by hand with a bump: patch, minor or major) owns the
  version: it bumps `package.json`, tags `v<version>` on master, opens a draft release with generated notes, and builds
  every OS's installers onto it (`npm run release`). Publishing the draft makes the update reach every running app
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
- macOS signing and notarization turn on once the `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` secrets exist; without them the build is unsigned and updates by its
  disk image. Windows builds are unsigned: electron-updater checks an installer's publisher only when the app names one.
- The feed must be readable without signing in: electron-updater reads a private repository's releases only with a
  token, which the app never ships. While the repository is private, a check says "No published release is available
  to update from yet."

## CI

`.github/workflows/ci.yml` runs on every push to master and every pull request: the tests and the build on macOS
arm64, Windows x64 and arm64 and Linux x64, the typecheck once on Linux, and the smoke test (`npm run e2e`) inside the
macOS and Windows x64 jobs. The shared install step (`.github/actions/install`) pins Node, restores `node_modules` from
the last install of the same lockfile (`reuse-node-modules`, CI only: releases install clean), or else caches npm's and
Electron's downloads and retries `npm ci`. On a Windows runner with a raw local SSD (arm64) the job formats it as a Dev
Drive and builds there (`BUILD_DIR`). How fast the tests run on CI's 2-CPU runners, and why: `vitest.config.ts`.

`.github/workflows/codeql.yml` runs GitHub's CodeQL security analysis on pushes to master, pull requests and weekly.
Code scanning needs a public repository, so while this one is private the job passes without scanning.
