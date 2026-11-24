import { execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { unpackBundle } from '../unpackBundle';
import { authenticodeCheck, DECLINED_EXIT_CODE, macInstallerRun, pkgutilCheck, windowsInstallerRun, type ToolCommand } from './installerCommands';
import { authenticodeVerdict, pkgutilVerdict } from './installerSignature';
import {
  DEFAULT_LINUX_PACKAGE,
  linuxPackageManagerOf,
  linuxUpdateCommand,
  packageFromDpkgSearch,
  packageFromRpmQuery,
  type PackageOwnerTool,
} from './linuxUpdateCommand';
import type { OfficialUpdateTools } from './OfficialClientUpdate';

interface ToolResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Runs a tool to its end, whatever its exit code: what it printed says how it went. */
function runTool({ command, args, env, input }: ToolCommand): Promise<ToolResult> {
  return new Promise((resolve) => {
    const child = execFile(command, args, { env: { ...process.env, ...env }, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error && typeof error.code === 'number' ? error.code : error ? -1 : 0;
      resolve({ stdout, stderr: stderr || (error && code === -1 ? error.message : ''), exitCode: code });
    });
    // A tool that exits without reading its input closes the pipe first: no error to throw.
    child.stdin?.on('error', () => undefined).end(input);
  });
}

/** Which package owns `cm`, as dpkg or rpm say, with the tool that knew; none when neither does (or isn't there). */
async function linuxPackageOf(cmPath: string): Promise<{ pkg: string | null; tool: PackageOwnerTool | null }> {
  const resolved = await realpath(cmPath).catch(() => cmPath);
  const dpkg = packageFromDpkgSearch((await runTool({ command: 'dpkg', args: ['-S', resolved], env: {} })).stdout);
  if (dpkg) return { pkg: dpkg, tool: 'dpkg' };
  const rpm = packageFromRpmQuery((await runTool({ command: 'rpm', args: ['-qf', '--queryformat', '%{NAME}\\n', resolved], env: {} })).stdout);
  return rpm ? { pkg: rpm, tool: 'rpm' } : { pkg: null, tool: null };
}

/**
 * What the OS does for the installed one's update (docs/features/cm-runtime.md "Updating the installed one"): each
 * starts a process only on the user's click (the signature check, the installer), except Linux's package lookup, asked
 * as the update screen shows, which opens nothing.
 */
export function officialUpdateTools(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): OfficialUpdateTools {
  return {
    checkSignature: async (installer) => {
      if (platform === 'win32') return authenticodeVerdict((await runTool(authenticodeCheck(installer, env))).stdout);
      return pkgutilVerdict((await runTool(pkgutilCheck(installer))).stdout);
    },
    run: async (installer) => {
      const { exitCode } = await runTool(platform === 'win32' ? windowsInstallerRun(installer.path, env) : macInstallerRun(installer.path));
      return platform === 'win32' && exitCode === DECLINED_EXIT_CODE ? { kind: 'declined' } : { kind: 'ended', exitCode };
    },
    unpack: (archive, destination) => unpackBundle(archive, destination, platform, env),
    linuxUpdateCommand: async (cmPath) => {
      const { pkg, tool } = await linuxPackageOf(cmPath);
      const osRelease = await readFile('/etc/os-release', 'utf8').catch(() => '');
      return linuxUpdateCommand(linuxPackageManagerOf(osRelease, tool), pkg ?? DEFAULT_LINUX_PACKAGE);
    },
  };
}
