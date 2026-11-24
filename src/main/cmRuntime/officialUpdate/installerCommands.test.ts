import { describe, expect, it } from 'vitest';
import { authenticodeCheck, DECLINED_EXIT_CODE, INSTALLER_PATH_VARIABLE, macInstallerRun, pkgutilCheck, windowsInstallerRun } from './installerCommands';

const WINDOWS_ENV = { SystemRoot: 'C:\\Windows' };
const WINDOWS_INSTALLER = 'C:\\Users\\José María\\AppData\\Local\\Temp\\unity-version-control-update\\unity-vcs-11.0.16.10694-win.exe';
const MAC_PACKAGE = '/var/folders/x y/T/unity-version-control-update/unity-vcs-11.0.16.10694-mac-arm.pkg.zip.unpacked/unity-vcs-osx-arm64-11.0.16.10694.pkg';

describe('windowsInstallerRun', () => {
  it("runs System32's PowerShell, never the first one on the PATH", () => {
    expect(windowsInstallerRun(WINDOWS_INSTALLER, WINDOWS_ENV).command).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    expect(windowsInstallerRun(WINDOWS_INSTALLER, {}).command).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  });

  it('passes the path in the environment, so no space or accent reaches the command line', () => {
    const run = windowsInstallerRun(WINDOWS_INSTALLER, WINDOWS_ENV);
    expect(run.env).toEqual({ [INSTALLER_PATH_VARIABLE]: WINDOWS_INSTALLER });
    expect(run.args.join(' ')).not.toContain('José');
  });

  it("starts the installer elevated, so Windows asks for permission, unattended with its own dialogs, and waits for it", () => {
    const script = windowsInstallerRun(WINDOWS_INSTALLER, WINDOWS_ENV).args.at(-1)!;
    expect(script).toContain(`$env:${INSTALLER_PATH_VARIABLE}`);
    expect(script).toContain("'runas'");
    expect(script).toContain('--mode unattended --unattendedmodeui minimalWithDialogs');
    expect(script).toContain('WaitForExit()');
    expect(script).toContain(`exit ${DECLINED_EXIT_CODE}`);
  });

  it("never asks the installer to start the official client once it's done", () => {
    expect(windowsInstallerRun(WINDOWS_INSTALLER, WINDOWS_ENV).args.join(' ')).not.toMatch(/launch|restart|relaunch|--gui/i);
  });

  it('runs PowerShell without the user’s profile, nor a prompt', () => {
    expect(windowsInstallerRun(WINDOWS_INSTALLER, WINDOWS_ENV).args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command']);
  });
});

describe('authenticodeCheck', () => {
  it('asks Windows for the signature of the file the environment names, and prints its status and signer', () => {
    const check = authenticodeCheck(WINDOWS_INSTALLER, WINDOWS_ENV);
    expect(check.env).toEqual({ [INSTALLER_PATH_VARIABLE]: WINDOWS_INSTALLER });
    expect(check.args.at(-1)).toContain(`Get-AuthenticodeSignature -LiteralPath $env:${INSTALLER_PATH_VARIABLE}`);
    expect(check.args.at(-1)).toContain('Status=');
    expect(check.args.at(-1)).toContain('Subject=');
  });
});

describe('macOS', () => {
  it("opens the package in Installer.app and waits for it to close, the path as it is", () => {
    expect(macInstallerRun(MAC_PACKAGE)).toEqual({ command: '/usr/bin/open', args: ['-W', MAC_PACKAGE], env: {} });
  });

  it("checks the package's signature with pkgutil", () => {
    expect(pkgutilCheck(MAC_PACKAGE)).toEqual({ command: '/usr/sbin/pkgutil', args: ['--check-signature', MAC_PACKAGE], env: {} });
  });
});
