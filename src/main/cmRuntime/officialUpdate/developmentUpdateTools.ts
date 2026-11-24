import { writeFile } from 'node:fs/promises';
import type { OfficialUpdateTools } from './OfficialClientUpdate';

/**
 * What a development build fakes of the installed one's update (`UVCS_FAKE_OFFICIAL_UPDATE`, docs/features/cm-runtime.md
 * "Updating the installed one"), so every state can be seen without running a real installer: the installer `installs`
 * (the smoke test's fake `cm` then prints the new version), `fails` (it ends and the version is the same), is
 * `declined`, or is `unsigned`; or the computer is `linux`, which has no installer.
 */
export type DevelopmentUpdate = 'installs' | 'fails' | 'declined' | 'unsigned' | 'linux';

const DEVELOPMENT_UPDATES: readonly DevelopmentUpdate[] = ['installs', 'fails', 'declined', 'unsigned', 'linux'];

/** The faked outcome a development build asks for; never in a packaged app, where nothing may skip the signature check. */
export function developmentUpdateOf(env: NodeJS.ProcessEnv, isPackaged: boolean): DevelopmentUpdate | null {
  const asked = env.UVCS_FAKE_OFFICIAL_UPDATE as DevelopmentUpdate | undefined;
  return !isPackaged && asked && DEVELOPMENT_UPDATES.includes(asked) ? asked : null;
}

export interface DevelopmentUpdateSetup {
  /** `UVCS_FAKE_CM_VERSION_FILE`, where the fake `cm` reads the version it prints. */
  versionFile: string | undefined;
  /** How long the fake installer takes, so its state can be seen (`UVCS_FAKE_OFFICIAL_UPDATE_MS`). */
  wait: () => Promise<void>;
}

/**
 * The tools a development build uses instead of the OS's: the real ones download and unpack (and find Linux's command),
 * but nothing checks a signature or starts a process; the installer only waits, then writes the version it installs
 * for the fake `cm`.
 */
export function developmentUpdateTools(update: DevelopmentUpdate, real: OfficialUpdateTools, { versionFile, wait }: DevelopmentUpdateSetup): OfficialUpdateTools {
  return {
    checkSignature: async () => (update === 'unsigned' ? { trusted: false, why: 'Its signature is NotSigned' } : { trusted: true }),
    run: async (installer) => {
      await wait();
      if (update === 'declined') return { kind: 'declined' };
      if (update !== 'installs') return { kind: 'ended', exitCode: 1 };
      if (versionFile) await writeFile(versionFile, installer.version);
      return { kind: 'ended', exitCode: 0 };
    },
    unpack: real.unpack,
    linuxUpdateCommand: real.linuxUpdateCommand,
  };
}
