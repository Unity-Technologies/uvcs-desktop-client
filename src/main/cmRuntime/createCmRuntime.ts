import { homedir } from 'node:os';
import { net } from 'electron';
import type { CmRuntimeStatus } from '@shared/domain/cmRuntime';
import type { CommandLogEntry } from '@shared/events';
import pin from '../../../cm-version.json';
import { findInstalledCm } from '../cm/findInstalledCm';
import { runCmProcess } from '../cm/runCmProcess';
import type { SettingsStore } from '../settings/SettingsStore';
import { CM_BUNDLES_URL } from './cmBundles';
import { CmInstaller } from './CmInstaller';
import { CmRuntime } from './CmRuntime';
import { cmStoreFolder } from './cmStore';
import { unpackBundle } from './unpackBundle';

interface CmRuntimeWiring {
  settings: Pick<SettingsStore, 'get' | 'update'>;
  /** Packaged builds delete the versions no longer kept; development builds, sharing the store, never do. */
  prunes: boolean;
  /** `CmClient.relocate`: the `cm` to run changed. */
  relocated: () => void;
  /** `CmClient.logEntry`: the command log shows the `cm version` checks run apart from it. */
  logCommand: (entry: Omit<CommandLogEntry, 'id'>) => void;
  statusChanged: (status: CmRuntimeStatus) => void;
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
export function createCmRuntime({ settings, prunes, relocated, logCommand, statusChanged }: CmRuntimeWiring): CmRuntime {
  const versionOf = versionReader(logCommand);
  const installer = new CmInstaller({
    store: cmStoreFolder(process.platform, process.env, homedir()),
    platform: process.platform,
    bundlesUrl: process.env.UVCS_CM_BUNDLES_URL || CM_BUNDLES_URL,
    fetch: (url, init) => net.fetch(url, init),
    unpack: (archive, destination) => unpackBundle(archive, destination, process.platform, process.env),
    cmVersionOf: versionOf,
  });
  return new CmRuntime({
    pin,
    platform: process.platform,
    arch: process.arch,
    environmentPath: process.env.UVCS_CM_PATH || undefined,
    installer,
    choice: () => settings.get().cmChoice,
    saveChoice: (cmChoice) => settings.update({ cmChoice }),
    findInstalled: () => findInstalledCm(),
    versionOf,
    relocated,
    statusChanged,
    prune: (pinned) => {
      if (prunes) void installer.prune(pinned);
    },
    timers: { now: Date.now, setTimeout: (run, ms) => setTimeout(run, ms), clearTimeout: (timer) => clearTimeout(timer as NodeJS.Timeout) },
  });
}
