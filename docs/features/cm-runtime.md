# The app's own `cm`

The app runs its own `cm`: one exact version per version of the app, downloaded on the first run and with each
update that needs another, kept in a folder of the app's. Nothing has to be installed, and a release can rely on what
its `cm` does. The user may still run the `cm` installed on the computer instead (Settings › Workspaces › Command line
client). The code is in `main/cmRuntime/` and `app/cmSetup/` (the renderer).

## The pin

`cm-version.json`, at the repository's root, names the version and, per platform, the bundle that holds it and the
SHA-256 of that file (`CmVersionPin`, `cmBundles.ts`):

```json
{ "version": "11.0.16.10659",
  "bundles": { "darwin-arm64": { "file": "client-macos-arm64.tar.gz", "sha256": "…" }, … } }
```

- **Written only by `npm run cm:bump <version>`** (`scripts/build/cmVersion.ts`): it downloads that version's four
  bundles, fails if any is missing, unpacks this machine's and checks its `cm version` prints the version, and writes
  the file. A pull request that needs a newer `cm` bumps it; when two do, the highest version stays.
- **Exact, never a minimum**: every user of a release runs the `cm` it was tested with. Nothing reads `latest`, which
  lags behind what's published.
- **Bundles**: `win32-x64` (a zip), `darwin-x64`, `darwin-arm64` and `linux-x64` (gzipped tars), all unpacking into
  `client/` with `cm` or `cm.exe` inside (`CM_BUNDLE_FILES`). Windows on Arm runs the x64 one, emulated
  (`cmBundleFor`). Linux on Arm has none: it runs the installed `cm`, as before.
- **Where**: `cmBundleUrl(version, file)`, under `CM_BUNDLES_URL`. `UVCS_CM_BUNDLES_URL` names another site laid out
  the same way (a failure shown on purpose, a throttled local copy to watch the setup); the SHA-256 still applies.
- **Why a hash**: unpacking and `cm version` already catch a damaged download. The hash catches a file that isn't the
  one published when the pin was written: changed on the way (a proxy, a mirror, a compromised host) or republished
  under the same version. Either way it fails loudly (`damaged`) rather than run something else under a known version.
- **Checked** before a release (the Release workflow's "Check the pinned cm bundles", `npm run cm:check`) and every
  day (`.github/workflows/cm-bundles.yml`): a bundle gone or changed would stop every new install. That workflow also
  sets the pinned `cm` up with the app's own code on macOS, Windows x64 and arm64 and Linux (`npm run cm:setup-check`,
  `scripts/build/cmSetupCheck.ts`), every day and on pull requests that change it or the pin. `cmBundles.test.ts`
  checks the file's shape (`pinProblems`).
- The Release workflow attaches the pin to each release (`cm-version.json`), which a running app reads before
  restarting into it ("Updates bring their cm").

## The store

`cmStoreFolder` (one folder per version, `cmStoreEntries`):

| OS      | Folder                                                    |
| ------- | --------------------------------------------------------- |
| Windows | `%LOCALAPPDATA%\Unity Version Control\cm`                 |
| macOS   | `~/Library/Application Support/Unity Version Control/cm`  |
| Linux   | `$XDG_DATA_HOME/unity-version-control/cm` (`~/.local/share`) |

On Windows and Linux, not the user data folder, which roams with the profile on Windows and is `~/.config` on Linux;
on macOS, inside it. Never a cache folder, which the OS may empty: the app couldn't start offline. Each version is
`<version>/client/cm[.exe]` (`managedCmPath`); `<version>.partial` is a download cut short, and `<version>.unpacking`
a bundle being checked.

**Removing old versions** (`CmInstaller.prune`, `storeEntriesToPrune`): once a `cm` first runs in a launch, packaged
builds delete every version but the pinned one and the newest above it, which an update downloaded to run and keeps
until it starts, across restarts. Development builds share the store and never prune. What can't be deleted (a `cm`
still running from it) waits for the next start. The Windows
uninstaller removes the store, but not on an update, which runs the old version's uninstaller too (`installer.nsh`).

## Setting it up

`CmInstaller.install` (one install per version at a time; a second ask joins it):

1. Downloads the bundle with Electron's `net` (the system's proxy, PAC script and certificates, as Chromium; Node's
   `fetch` knows none of them) into `<version>.partial`, resuming what an earlier attempt left (`downloadBundle`: a
   `Range` request; a site that answers the whole file again starts over; one already whole and as published asks
   nothing), and checks its SHA-256. A download that gets no byte for a minute fails as `unreachable`
   (`STALL_TIMEOUT_MS`): a captive portal or a proxy can keep a connection open without sending anything.
2. Unpacks it into `<version>.unpacking` with the system's `tar` (`unpackBundle`, `tarPath`; on Windows System32's,
   which reads zip, never Git's GNU tar from the PATH), run in the store and given the entries' plain names, so no
   folder name of the user's reaches its command line. Nothing is quarantined: the app downloads it itself.
3. Runs its `cm version` (`versionReader`, logged in the command log), which must print the pinned version, then
   renames the folder to `<version>` in one step, tried again for a few seconds while Windows holds a file just
   written
   (`RENAME_RETRY_DELAYS_MS`), and deletes the download. Another copy of the app that set up the same version
   meanwhile wins.

A failure has a kind (`CmInstallFailure`, `cmInstallFailureOf`): `offline`, `unreachable`, `proxyAuthentication`,
`unavailable` (the site has no such bundle) or `damaged` (not as published: the download is deleted, so the next
attempt starts over) while downloading; once it checked out as published, never the network's (`localFailureOf`):
`diskFull`, `notWritable`, or `blocked` (this computer didn't let it unpack or run: a policy against programs in the
user's folders, a library missing), which keep the download for Try Again. Only the network's pass by themselves
(`retriesByItself`): those retry after 5 s, 15 s, 1 min and then every 5 min (`installRetries`), and as soon as the
page hears it's back online (`useRetryWhenOnline`). The details name the address and the error.

## Which cm runs

`chooseCm`, asked by `CmClient` for its executable (`CmRuntime.cmPath`):

1. `UVCS_CM_PATH` (development, the smoke test): source `environment`.
2. The installed one (`findInstalledCm`: the PATH, then the installers' locations) when the user chose it
   (`cmChoice: 'installed'`) and it's there.
3. The app's own of the pinned version: source `managed`.
4. Where the app has none of its own (Linux on Arm), the installed one, found or not: one not found shows
   `CmUnavailableScreen`, as before.

A change of choice (`cmRuntime.use`) restarts `CmClient`'s shells (`relocate`), and every window asks again which `cm`
runs and whether it's set up (`cmChanged`; `system.cmVersion` answers per executable, and logs the new one). Going
back to the app's own before it's there keeps the installed one running while it downloads, Settings showing how far
(`OwnCmSwitch`), and switches once it's set up; a failure leaves the installed one, and the choice, as they were. The
app's own `cm` shares the user's `cm` configuration (the config folder, profiles, tokens):
`cm` reads it backward compatibly, so the app's own and an installed one can be switched freely.

## The setup screen

While the app's own `cm` isn't there, nothing runs `cm` (`CmRuntime.isReady`): the main process reads nothing ahead
(`readFirstScreenAhead`, `openFirstWindow`'s `cmReady`), and a window opened meanwhile names the setup in its address
(`cmSetupQuery`: `settingUp` on the first run, `updating` when an older version is kept), so its first frame is the
setup screen (`CmSetupScreen`), never its place. The page's store (`cmRuntimeStore`) follows `cmRuntimeChanged`;
`App` shows the screen instead of everything that may ask `cm` (the views, the palette, the corner cards) until it's
ready, and then the window's place or Home, with no click. What it shows is `cmSetupViewOf`:

- **Words**: "Setting up Unity Version Control", "This happens once and takes a moment."; an update's: "Updating
  Unity Version Control", "A newer version came with this update." Never `cm`, command line, bundle or install.
- **The bar**: the download takes its first 90% (`CM_SETUP_DOWNLOAD_SHARE`), unpacking and checking the rest
  ("Finishing…", a light running along it); without a size yet, the light runs along it all. Under it, "48 MB of 78 MB
  · 12 s left": the time left only once the pace settles (2 s, smoothed: `downloadRate`).
- **Calm**: the app's mark shows at once, the words and the bar after 1.5 s, so a short setup never flashes them. No
  button and no Cancel: there is nothing else to do. The Dock or taskbar icon shows the same progress
  (`cmSetupIconProgress`).
- **A failure** says why in plain words, whether it retries by itself, offers Try Again and, when one is installed,
  "Use the installed one (version)", which switches to it (`cmRuntime.use('installed')`), with the address and error
  folded under Details.

Users of a version before the app had its own `cm` see the screen once too, as on a first run: an installed `cm` is
never taken as the app's own. A folder named at launch (Windows, Linux) opens once the setup is done: finding its
workspace asks `cm` (`handleLaunchRequests`, `CmRuntime.whenReady`).

After it, a computer that never had Unity Version Control has no `cm` configuration: `SetupProblemScreen` shows the
command that sets it up in a terminal with the app's own `cm` named in full, as it isn't on the PATH
(`cmCommandLine`).
If the app's own `cm` later doesn't start, `CmUnavailableScreen` says this computer stops it, and asks nothing to be
installed (`cmUnavailableView`).

## Updates bring their cm

When an update is found, `AppUpdates` reads the `cm` it pins (`readReleaseCmPin`, its release's `cm-version.json`; a
release without one has none to download). If the app's own `cm` runs and that version isn't there
(`CmRuntime.prefetchFor`), it downloads it after the app's own download, each taking half of the update's progress
(`APP_SHARE_WITH_CM`); "Restart & Install" is offered once both are there, so the new version starts at once. A
failure there never stops the update: the new version sets its `cm` up as it starts, with the "Updating" screen.

## Settings

Settings › Workspaces › Command line client (`CmChoiceGroup`, `cmChoiceCards`): "Included with the app" (its version,
or its download's progress while it replaces the installed one) and "Installed on this computer" (its version and
path, from one `cm version` each time Settings opens; "Not found"
and disabled when there is none; in the caution color when older than the app's own). `UVCS_CM_PATH` overrides both:
neither is checked, and a line says why.

## Seeing which cm runs

About's `cm` row says its version and which one it is ("11.0.16.10659, included with the app", `aboutCmValue`), and
its button shows that `cm` in the file manager (`cmRuntime.reveal`, `CmRuntime.revealCm`), as Help ▸ Show Command Line
Client does from the menu bar: the app's own in its store, or the installed one.

## Rejected

- **Shipping `cm` in the installers**: the bundles are 45-130 MB (unpacked 100-260 MB), which every installer and
  every update would carry even when `cm` didn't change.
- **A minimum version over an installed `cm`**: an installed `cm` older than a feature needs would stop the user's
  work with a request to update another product; the app's own pinned one never does.
- **Checking sizes in the pin**: the download's `Content-Length` gives the progress, and the hash checks the rest.
