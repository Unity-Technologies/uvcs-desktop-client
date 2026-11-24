import { win32 } from 'node:path';

/** A process to start: what, with which arguments, what to add to its environment, and what to write to its input. */
export interface ToolCommand {
  command: string;
  args: string[];
  env: Record<string, string>;
  input?: string;
}

/**
 * The environment variable that names the installer to PowerShell's scripts: the path never reaches the command line,
 * where a user name's accents would go through a code page Windows may not agree with, and a quote could end the
 * script's string.
 */
export const INSTALLER_PATH_VARIABLE = 'UVCS_OFFICIAL_INSTALLER';

/** The exit code `windowsInstallerRun`'s script ends with when the user didn't allow the installer: Windows' `ERROR_CANCELLED`. */
export const DECLINED_EXIT_CODE = 1223;

/** System32's PowerShell, never the first one on the PATH, which anyone may have put there. */
function powerShellPath(env: NodeJS.ProcessEnv): string {
  return win32.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

/**
 * PowerShell running `statements`, read from its input (`-Command -`): no quote of the script meets Windows'
 * command-line quoting, and no encoded script reaches the command line. PowerShell reads its input as typed, a line
 * at a time, so the statements go as one line: a block split over lines could wait for more.
 */
function powerShell(statements: string[], installer: string, env: NodeJS.ProcessEnv): ToolCommand {
  return {
    command: powerShellPath(env),
    args: ['-NoProfile', '-NonInteractive', '-Command', '-'],
    env: { [INSTALLER_PATH_VARIABLE]: installer },
    input: `${statements.join('; ')}\n`,
  };
}

/** Prints the installer's Authenticode signature as `authenticodeVerdict` reads it: its status, and its signer's subject. */
export function authenticodeCheck(installer: string, env: NodeJS.ProcessEnv): ToolCommand {
  const statements = [
    `$signature = Get-AuthenticodeSignature -LiteralPath $env:${INSTALLER_PATH_VARIABLE}`,
    '"Status=$($signature.Status)"',
    '"Subject=$($signature.SignerCertificate.Subject)"',
  ];
  return powerShell(statements, installer, env);
}

/**
 * Runs the Windows installer as the official client does (unattended, its own small dialogs showing progress), but
 * elevated, so Windows asks the user's permission (a plain start fails without it), and without the option that starts
 * the official client when it's done. It waits for the installer and ends with its exit code, or `DECLINED_EXIT_CODE`
 * when the user didn't allow it. It's started through .NET rather than `Start-Process`, whose error on a declined prompt
 * keeps only a translated message; .NET's carries Windows' own code.
 */
export function windowsInstallerRun(installer: string, env: NodeJS.ProcessEnv): ToolCommand {
  const declined = `$cause = $_.Exception; while ($cause) { if ($cause.NativeErrorCode -eq 1223) { exit ${DECLINED_EXIT_CODE} }; $cause = $cause.InnerException }`;
  const statements = [
    `$start = New-Object System.Diagnostics.ProcessStartInfo $env:${INSTALLER_PATH_VARIABLE}`,
    "$start.Arguments = '--mode unattended --unattendedmodeui minimalWithDialogs'",
    "$start.Verb = 'runas'",
    '$start.UseShellExecute = $true',
    `try { $installer = [System.Diagnostics.Process]::Start($start) } catch { ${declined}; [Console]::Error.WriteLine($_.Exception.Message); exit 1 }`,
    '$installer.WaitForExit()',
    'exit $installer.ExitCode',
  ];
  return powerShell(statements, installer, env);
}

/** Checks the macOS package's signature and notarization, printed as `pkgutilVerdict` reads it. */
export function pkgutilCheck(pkg: string): ToolCommand {
  return { command: '/usr/sbin/pkgutil', args: ['--check-signature', pkg], env: {} };
}

/**
 * Opens the macOS package in Installer.app, as the official client does: the user goes through its steps and gives
 * their password there. `-W` waits until Installer.app closes, so the app knows when it's done.
 */
export function macInstallerRun(pkg: string): ToolCommand {
  return { command: '/usr/bin/open', args: ['-W', pkg], env: {} };
}
