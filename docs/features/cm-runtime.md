# The `cm` the app runs

The app runs the `cm` installed on the computer when there is one, at the pinned version (`cm-version.json`) or newer.
Where none is installed, it runs its own: that exact version, downloaded on the first run and with each update that
needs another, kept in a folder of the app's, so nothing has to be installed. An installed one older than the pinned
version brings up the update screen. Every feature relies on what the pinned version does, never more, so no feature
checks the version itself. The code is in `main/cmRuntime/` and `app/cmSetup/` (the renderer).

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
- **The floor**: the oldest `cm` the app runs, and the one its code and tests are written against; `cm` reads older
  workspaces and configuration as it always did, so a newer installed one runs too (see "Which cm runs"). The app's
  own is that exact version: nothing reads `latest`, which lags behind what's published. A bump brings up the update
  screen for an installed one older than the new pin, so a pin is bumped only when a feature needs it, and never past
  what the official installers have published.
- **Bundles**: `win32-x64` (a zip), `darwin-x64`, `darwin-arm64` and `linux-x64` (gzipped tars), all unpacking into
  `client/` with `cm` or `cm.exe` inside (`CM_BUNDLE_FILES`). Windows on Arm runs the x64 one, emulated
  (`cmBundleFor`). Linux on Arm has none, and no installer either (releases build Linux on x64): a build from the
  sources there runs the installed `cm`.
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
until it starts, across restarts. When the installed one runs, once its version is known to be new enough
(`CmRuntime.admits`), they delete every version: the app's own is downloaded again if it's ever needed. Development builds share the store and never prune. What can't be deleted (a `cm`
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

`chooseCm`, asked by `CmClient` for its executable (`CmRuntime.cmPath`), with the user's `cmChoice`:

1. `UVCS_CM_PATH` (development, the smoke test): source `environment`.
2. `automatic`, the default until the user chooses, and `installed`, chosen in Settings: the installed one
   (`findInstalledCm`: the PATH, then the installers' locations) when one is found, unless this launch found it too old
   and the user runs the app's own for now (`refusedInstalledPath`).
3. The app's own of the pinned version: source `managed`. `managed` always runs it, even with one installed.
4. Where the app has none of its own (Linux on Arm), the installed one, found or not: one not found shows
   `CmUnavailableScreen`.

Each launch chooses again, so an installation that appeared, or was updated to the pinned version or newer, runs from
the next launch on without asking.

**Never an installed `cm` older than the pinned version** (`meetsCmVersion`): it's caught by the `cm version` the
first window reads as it opens (`system.cmVersion`), so it costs no command of its own; what started before that
answers (the window's first reads, `readFirstScreenAhead`) still runs on it once. `CmRuntime.admits` then shows the
update screen (status `installedTooOld`, "The update screen"), unless the user chose "Use the included version for
now" for this pinned version (`cmDeclinedUpdateFor`): then the app's own runs at once, set up first when it isn't
there. Where the app has none of its own, `CmUnavailableScreen` names both versions (the ready status's `installedTooOld`),
and Check Again reads the version again. `UVCS_CM_PATH` is never checked.

A change of choice (`cmRuntime.use`) restarts `CmClient`'s shells (`relocate`), and every window asks again which `cm`
runs and whether it's set up (`cmChanged`; `system.cmVersion` answers per executable, and logs the new one). Choosing
the installed one reads its version first (`usableInstalledCm`), and an older one is refused: Settings never offers it.
Going back to the app's own before it's there keeps the installed one running while it downloads,
Settings showing how far (`OwnCmSwitch`), and switches once it's set up; a failure leaves the installed one, and the
choice, as they were. The app's own `cm` shares the user's `cm` configuration (the config folder, profiles, tokens):
`cm` reads it backward compatibly, so the app's own and an installed one can be switched freely.

**Why the installed one first.** `cm` reads `client.conf` from its own executable's folder before the user's config
folder: a configuration placed next to an installed `cm` (as some organizations deploy it) is invisible to the app's
own. And two `cm` versions on one computer can write a workspace's metadata in different formats, which the older one
may then refuse. Running the installed one avoids both, without the app reading `cm`'s files.

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
- **A failure** says why in plain words, whether it retries by itself, offers Try Again and, when one at the pinned
  version or newer is installed (only when the user chose the app's own), "Use the installed one (version)", which
  switches to it (`cmRuntime.use('installed')`), with the address and error folded under Details.

Where no `cm` is installed, users of a version before the app had its own `cm` see the screen once too, as on a first
run: an installed `cm` is never taken as the app's own. A folder named at launch (Windows, Linux) opens once the setup is done: finding its
workspace asks `cm` (`handleLaunchRequests`, `CmRuntime.whenReady`).

After it, a computer that never had Unity Version Control has no `cm` configuration: `SetupProblemScreen` shows the
command that sets it up in a terminal with the app's own `cm` named in full, as it isn't on the PATH
(`cmCommandLine`).
If the app's own `cm` later doesn't start, `CmUnavailableScreen` says this computer stops it, and asks nothing to be
installed (`cmUnavailableView`).

## The update screen

When the installed `cm` is older than the pinned version and the user hasn't chosen the app's own, the setup screen's place holds
the update screen instead (`CmUpdateNeeded`, its words from `cmUpdateViewOf`): nothing runs `cm` (`CmRuntime.isReady`
is false), and the windows wait as they do for a setup.

- **Words**: "Update Unity Version Control", "This app needs a newer version of Unity Version Control on this
  computer.", both versions on a line of their own (`cmVersionWords`), then "It takes a minute, and your workspaces
  aren't changed." Never `cm`, command line, installer, bundle or token; the installed one's path, and any error,
  only under Details.
- **Update** (primary) updates it with its own installer ("Updating the installed one"): the installer downloads in the
  background as soon as the screen shows (`cmRuntime.prepareUpdate`, a line under the buttons says how far: "Downloading
  the update… 42%", then "The update is ready to install."), and the click runs it (`cmRuntime.updateInstalled`). While
  it runs: "Updating Unity Version Control…", the download's bar if it isn't done, then "Your computer may ask for
  permission." with "Installed: 11.0.16.9000 · Installing: 11.0.16.10729"; the Dock or taskbar icon shows the same
  (`cmSetupIconProgress`). Once the installed one is new enough the window goes on to its place: no restart.
- **A failure** says "Couldn't update Unity Version Control", why in plain words (`UPDATE_FAILURE_REASONS`: no newer
  version yet, the download failed, not signed by Unity, the permission declined, or the installer ended and the
  version is the same: "Close the other Unity Version Control apps, then try again. This computer may also not allow
  installing programs."), "You can keep working with the version included with the app.", and offers Try Again and
  Use the Included Version, the error under Details. A failure of the download in the background shows nothing: the
  click tries it all again, and says why then.
- **"Use the included version for now"** (`cmRuntime.useIncludedForNow`) runs the app's own, set up first with the
  setup screen when it isn't there, and saves the pinned version as `cmDeclinedUpdateFor`: the screen doesn't ask again
  until the pin moves. The choice stays as it was, so once the installed one is new enough, it runs again without
  asking.
- **Linux** has no installer: the screen shows the command that updates it, with Copy, Check Again
  (`cmRuntime.checkInstalledAgain`: one `cm version`, logged) and "Use the included version for now".
- **Checked again as a window gains focus** (the user may come back from updating it another way), quietly, never on a
  timer: new enough, it runs, its shells started again; none found any more, the app's own runs.

To see it in a development build: the smoke test's fake `cm` (`scripts/e2e/fakeCm`) on a temp PATH as `cm`, with
`UVCS_FAKE_CM_VERSION_FILE` naming a file that holds an older version, and no `UVCS_CM_PATH` (scripts/e2e/README.md).
"Updating the installed one" says how to reach each of its states.

## Updating the installed one

`OfficialClientUpdate` (`main/cmRuntime/officialUpdate/`) updates the official installation the way the official
client updates itself, with its own edition's installer, and asks Unity's download site only from the update screen or
Settings' Update link, never on a timer. It isn't `cm`, so the server budget doesn't apply.

1. **Edition** (`officialEditionOf`): a marker file next to the installed client, checked for and never read:
   `cloudedition.token` → `cloud`, `dvcs.token` → `dvcs`, none → `enterprise` (client only and full alike). On Windows
   it's the folder of `cm.exe` (`<install>\client\`); on macOS, links resolved first (`/usr/local/bin/cm` leads into
   PlasticSCM.app), it's inside the app bundle (`Contents/Applications/cm.app/Contents/MacOS/`, `Contents/MonoBundle/`,
   `Contents/MacOS/`). `noCmInternalFiles.test.ts` names this one exception: `cm` prints no edition.
2. **Platform** (`officialPlatformOf`): `windows`, `macos`, `macos-arm64` (the Mac's own architecture: Apple silicon
   even when the app runs under Rosetta, `app.runningUnderARM64Translation`) or `linux`.
3. **The latest version** (`lastVersionUrl`, `parseLastVersion`): `GET
   https://www.plasticscm.com/api/lastversion/after/<installed>/for/<edition>/<platform>` answers JSON (`version`,
   `installerUri`, `downloadLink`, …) or `null` when nothing is newer. The installer is `installerUri`, or
   `downloadLink` with `/download/` → `/download/downloadinstaller/`; it redirects to the file on Unity's CDN. A version
   still below the pin is a failure (`noUpdate`), never installed.
4. **Download** (`downloadBundle` with no SHA-256: Electron's `net`, so the system's proxy; resumed, its length checked)
   into the `update` folder beside the app's own `cm` store (`cmStoreFolder`'s parent), named `installerFileName`
   (`unity-vcs-<version>-<edition>-<platform>.exe` or `.pkg.zip`) because Electron's `net.fetch` doesn't tell the
   address a redirect ended at. Other files there (an older version's) are deleted; the folder is emptied once it
   installed. macOS's zip is unpacked with the system's `tar` (`unpackBundle`) to its one `.pkg`.
5. **Signature**, checked on the click, right before it runs (no checksum is published; `installerSignature.ts`):
   Windows, `Get-AuthenticodeSignature` through System32's PowerShell (`authenticodeCheck`) must say `Valid` and name
   `WINDOWS_INSTALLER_SIGNERS` (CN and O `Unity Technologies SF`); macOS, `pkgutil --check-signature`
   (`pkgutilCheck`) must say it's signed for distribution by a certificate Apple issued, notarized, and by a Developer
   ID Installer of `MAC_INSTALLER_TEAMS` (`Codice Software (BQ7R3Y4J72)`). Those are the signers of 11.0.16.10694's
   installers. Any other answer deletes the download (`notSigned`).
6. **Run** (`installerCommands.ts`), after `CmClient`'s shells are stopped (`CmClient.dispose`: they hold `cm`'s files,
   and the Windows installer stops while `cm` runs): Windows starts the installer elevated, so Windows asks for
   permission, unattended with its own small dialogs (`--mode unattended --unattendedmodeui minimalWithDialogs`),
   without the official client's option that starts it once done, and waits for it (`windowsInstallerRun`: .NET's
   `Process.Start` with the `runas` verb, so a declined prompt ends with Windows' `ERROR_CANCELLED`,
   `DECLINED_EXIT_CODE`); the path goes in an environment variable (`INSTALLER_PATH_VARIABLE`), never on the command
   line. macOS opens the package in Installer.app, as the official client does, and waits for it to close
   (`open -W`, `macInstallerRun`). Only the click starts it (`noExternalUi.test.ts`).
7. **Then** the installed one's version is read again (`CmRuntime.installedCm`). The pinned version or newer: it runs
   (`CmRuntime.updateInstalled`, its shells started again, `installedRevision` moved so no window keeps an answer the
   older one gave; the first window's answers read ahead are dropped, `EarlyCalls.dropAll`). Asking to update it is
   choosing it, so it runs even when the user had chosen the app's own: that choice goes back to the default
   (`automatic`), and "Use the Included Version for Now" is forgotten (`cmDeclinedUpdateFor` cleared); Settings' check
   mark moves to it. Otherwise it failed (`notUpdated`), and no choice changes: no exit code is trusted, only the
   version.

**Linux** (`linuxUpdateCommand.ts`): the package that owns the installed `cm`, links resolved (`dpkg -S`, else `rpm -qf
--queryformat '%{NAME}\n'`; `plasticscm-cloud`, `plasticscm-complete` or `plasticscm-client-core`, the last when
neither tool knows), and the distribution's package manager from /etc/os-release: `sudo apt-get update && sudo apt-get
install --only-upgrade <package>`, `sudo dnf upgrade <package>` or `sudo zypper update <package>`.

**Settings**: the installed card, when it's too old, has an Update link (none on Linux) that runs the same update, the
card saying how far it is ("Downloading the update… 42%", "Updating… Your computer may ask for permission.") or
"Couldn't update it." with the reason in its tip and Try Again.

**Seeing every state without a real installer** (development builds only; a packaged app ignores
`UVCS_FAKE_OFFICIAL_UPDATE`, so nothing there can skip the signature check):

- `UVCS_OFFICIAL_UPDATES_URL` names another site laid out as Unity's. `node scripts/e2e/fakeOfficialSite.mjs
  [--latest=<version>|--latest=none] [--missing-installer] [--slow]` serves one, with a small fake installer (macOS's
  zipped around a `.pkg`), and prints the variable to set.
- `UVCS_FAKE_OFFICIAL_UPDATE` fakes the OS's part (`developmentUpdateTools`): `installs` (the fake `cm` then prints the
  new version, through `UVCS_FAKE_CM_VERSION_FILE`), `fails` (it ends with the same version), `declined`, `unsigned`,
  or `linux` (with `UVCS_RENDERER_PLATFORM=linux`, the command). `UVCS_FAKE_OFFICIAL_UPDATE_MS` is how long the fake
  installer takes (1.5 s by default).

**Verified only with fakes**: the tests and the smoke test run no installer, and nothing here was run against a real
installation. Running the real installers (Windows' UAC prompt and a declined one, a Cloud and an on-premises
edition, macOS on Intel and Apple silicon, the other Unity Version Control apps open) is left to a person, on a virtual
machine with an older official installation.

## Updates bring their cm

When an update is found, `AppUpdates` reads the `cm` it pins (`readReleaseCmPin`, its release's `cm-version.json`; a
release without one has none to download). If the app's own `cm` runs and that version isn't there
(`CmRuntime.prefetchFor`), it downloads it after the app's own download, each taking half of the update's progress
(`APP_SHARE_WITH_CM`); "Restart & Install" is offered once both are there, so the new version starts at once. A
failure there never stops the update: the new version sets its `cm` up as it starts, with the "Updating" screen.

## Settings

Settings › Workspaces › Command line client (`CmChoiceGroup`, `cmChoiceCards`): two cards, the installed one first, as
the one the app prefers. The check marks the one that runs, chosen or not: until the user chooses (`automatic`), the
installed one when it's new enough, and the included one otherwise. Clicking a card chooses it (`installed` or
`managed`), and that sticks. "Installed on this computer" shows its version and path, from one `cm version` each time
Settings opens; "Not found" and disabled when there is none; disabled, in the caution color, with the version it needs,
when it's older than the app needs (`needsUpdate`), with an Update link at its end (`updateLabel`; "Updating the
installed one"). "Included with the app" shows its version, or its download's
progress while it replaces the installed one. `UVCS_CM_PATH` overrides both: neither is checked, and a line says why.
The words "automatic" and "Automatic" never show.

Every place that shows a version names it with `cmVersionWords` ("Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or
later", and "Installing: 11.0.16.10729" while it's updated): the update screen, the cards, `CmUnavailableScreen`.

Settings saved before the automatic choice existed (without `cmDeclinedUpdateFor`) move a `managed` to it once
(`storedCmChoice`): `SettingsStore` writes every setting on each change, so a `managed` saved then can't be told apart
from the old default. `installed` was always the user's choice and stays, as does a `managed` saved since.

## Seeing which cm runs

About's `cm` row says its version and which one it is ("11.0.16.10659, included with the app", `aboutCmValue`), and
its button shows that `cm` in the file manager (`cmRuntime.reveal`, `CmRuntime.revealCm`), as Help ▸ Show Command Line
Client does from the menu bar: the app's own in its store, or the installed one.

## Rejected

- **Running the app's own `cm` by default**, even with one installed: `cm` reads `client.conf` from its own folder
  first, so a configuration placed next to the installed one never reached the app's own, and two `cm` versions on one
  computer can write a workspace's metadata in different formats.
- **An "Automatic" card** beside the two: it was less clear than checking the one that runs.
- **Switching to the app's own in silence** when the installed one is too old: the reasons above for running the
  installed one still hold, so the update screen asks first.

- **Shipping `cm` in the installers**: the bundles are 45-130 MB (unpacked 100-260 MB), which every installer and
  every update would carry even when `cm` didn't change.
- **Checking the `cm` version per feature** (an edit offered only from the `cm` that has it): each check covers only
  the gap someone noticed, and every other feature still misbehaves on an older `cm`. The app's own is always there
  to run instead, so refusing an older installed one stops no one.
- **Checking sizes in the pin**: the download's `Content-Length` gives the progress, and the hash checks the rest.
- **Naming the installer as the CDN does** (the address its redirect ends at): Electron's `net.fetch` gives no
  `Response.url` after a redirect, so the app names the download itself (`installerFileName`).
- **Downloading the installer into the OS's temporary folder**: Electron's on macOS ignores `TMPDIR`, so a test's
  download would land in the user's own; it goes beside the app's `cm` store, whose environment the tests set.
- **Checking only the installer's length**, as the official client does: no checksum is published, and the signature
  shows it is Unity's, whichever version is latest.
- **`Start-Process -Verb RunAs`** to run the Windows installer: its error on a declined prompt keeps only a translated
  message, so the app couldn't tell a declined prompt from another failure; .NET's `Process.Start` keeps Windows' code.
