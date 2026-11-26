import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { app, net, shell } from 'electron';
import type { CmRuntimeStatus } from '@shared/domain/cmRuntime';
import type { CommandLogEntry } from '@shared/events';
import pin from '../../../cm-version.json';
import { findInstalledCm } from '../cm/findInstalledCm';
import { runCmProcess } from '../cm/runCmProcess';
import type { SettingsStore } from '../settings/SettingsStore';
import { CM_BUNDLES_URL } from './cmBundles';
import { CmInstaller } from './CmInstaller';
import { CmRuntime } from './CmRuntime';
import { cmStoreFolder, officialUpdateFolder } from './cmStore';
import { developmentUpdateOf, developmentUpdateTools } from './officialUpdate/developmentUpdateTools';
import { OfficialClientUpdate, type OfficialUpdateTools } from './officialUpdate/OfficialClientUpdate';
import { officialEditionOf } from './officialUpdate/officialEdition';
import { OFFICIAL_SITE, officialPlatformOf } from './officialUpdate/officialRelease';
import { officialUpdateTools } from './officialUpdate/officialUpdateTools';
import { unpackBundle } from './unpackBundle';

interface CmRuntimeWiring {
  settings: Pick<SettingsStore, 'get' | 'update'>;
  /** Packaged builds delete the versions no longer kept; development builds, sharing the store, never do. */
  prunes: boolean;
  /** `CmClient.relocate`: the `cm` to run changed, or was replaced at the same path (`replaced`). */
  relocated: (change: { replaced: boolean }) => void;
  /** `CmClient.logEntry`: the command log shows the `cm version` checks run apart from it. */
  logCommand: (entry: Omit<CommandLogEntry, 'id'>) => void;
  statusChanged: (status: CmRuntimeStatus) => void;
  /**
   * `CmClient.hold`: lets the commands running end, then ends its shells and starts no command while the installed one
   * is updated, as they hold its files open.
   */
  holdCm: () => Promise<(() => void) | null>;
}

/** A path with its links resolved (macOS's /usr/local/bin/cm leads into PlasticSCM.app); as it is when it can't be. */
function resolvedPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * The OS's tools for the installed one's update, or, in a development build asking for it (`UVCS_FAKE_OFFICIAL_UPDATE`),
 * fakes that start nothing (docs/features/cm-runtime.md "Updating the installed one").
 */
function updateToolsFor(development: ReturnType<typeof developmentUpdateOf>): OfficialUpdateTools {
  const real = officialUpdateTools(process.platform, process.env);
  if (!development) return real;
  const delayMs = Number(process.env.UVCS_FAKE_OFFICIAL_UPDATE_MS) || 1500;
  const wait = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, delayMs));
  return developmentUpdateTools(development, real, { versionFile: process.env.UVCS_FAKE_CM_VERSION_FILE, wait });
}

/**
 * What `cm version` prints for a `cm` not running yet: the one just unpacked, or the one installed on the computer.
 * Its own process, apart from `CmClient`, which runs only the `cm` chosen (the one exception to "CmClient is the single
 * entry point": ARCHITECTURE.md "How a request flows"); logged in the command log as `CmClient` logs its own.
 */
function versionReader(log: (entry: Omit<CommandLogEntry, 'id'>) => void): (cmPath: string) => Promise<string> {
  return async (cmPath) => {
    const startedAt = Date.now();
    const result = await runCmProcess(cmPath, ['version'], {}).catch((error: unknown) => ({ output: error instanceof Error ? error.message : String(error), exitCode: -1 }));
    const failed = result.exitCode !== 0;
    log({ commandLine: `"${cmPath}" version`, cwd: '', startedAt, durationMs: Date.now() - startedAt, exitCode: result.exitCode, viaShell: false, output: failed ? result.output : '' });
    if (failed) throw new Error(`${cmPath} version exited with ${result.exitCode}: ${result.output.trim()}`);
    return result.output;
  };
}

/** The app's `cm`, wired to Electron and the settings. Its setup starts with `start()`, once Electron is ready (`net`). */
export function createCmRuntime({ settings, prunes, relocated, logCommand, statusChanged, holdCm }: CmRuntimeWiring): CmRuntime {
  const versionOf = versionReader(logCommand);
  const store = cmStoreFolder(process.platform, process.env, homedir());
  const installer = new CmInstaller({
    store,
    platform: process.platform,
    bundlesUrl: process.env.UVCS_CM_BUNDLES_URL || CM_BUNDLES_URL,
    fetch: (url, init) => net.fetch(url, init),
    unpack: (archive, destination) => unpackBundle(archive, destination, process.platform, process.env),
    cmVersionOf: versionOf,
  });
  const development = developmentUpdateOf(process.env, app.isPackaged);
  const officialUpdate = new OfficialClientUpdate({
    platform: development === 'linux' ? 'linux' : officialPlatformOf(process.platform, process.arch, app.runningUnderARM64Translation),
    site: process.env.UVCS_OFFICIAL_UPDATES_URL || OFFICIAL_SITE,
    fetch: (url, init) => net.fetch(url, init),
    // Beside the app's own `cm` store, and emptied once the installer ran or nothing needs it. Not the OS's temporary
    // folder: Electron's on macOS ignores TMPDIR, so no test could keep its downloads apart.
    folder: officialUpdateFolder(process.platform, process.env, homedir()),
    discardDeletes: prunes,
    editionOf: (cmPath) => officialEditionOf(resolvedPath(cmPath), process.platform, existsSync),
    tools: updateToolsFor(development),
    holdCm,
    installedAgain: () => runtime.installedCm(),
    changed: () => runtime.officialUpdateChanged(),
    now: Date.now,
  });
  const runtime: CmRuntime = new CmRuntime({
    pin,
    platform: process.platform,
    arch: process.arch,
    environmentPath: process.env.UVCS_CM_PATH || undefined,
    installer,
    choice: () => settings.get().cmChoice,
    saveChoice: (cmChoice) => settings.update({ cmChoice }),
    declinedUpdateFor: () => settings.get().cmDeclinedUpdateFor,
    saveDeclinedUpdate: (cmDeclinedUpdateFor) => settings.update({ cmDeclinedUpdateFor }),
    findInstalled: () => findInstalledCm(),
    versionOf,
    relocated,
    statusChanged,
    reveal: (path) => shell.showItemInFolder(path),
    prune: (keep) => {
      if (prunes) void installer.prune(keep);
    },
    timers: { now: Date.now, setTimeout: (run, ms) => setTimeout(run, ms), clearTimeout: (timer) => clearTimeout(timer as NodeJS.Timeout) },
    officialUpdate,
  });
  return runtime;
}
