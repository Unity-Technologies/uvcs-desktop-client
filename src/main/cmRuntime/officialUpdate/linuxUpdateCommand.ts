/**
 * Linux has no installer to run: the official packages come from Unity's repositories, and the user updates them with
 * the distribution's package manager. The update screen shows the command for the package that holds the installed
 * `cm` (docs/features/cm-runtime.md "Updating the installed one").
 */

/** Unity Version Control's packages, any of which may hold the installed `cm`. */
export const LINUX_PACKAGES = ['plasticscm-cloud', 'plasticscm-complete', 'plasticscm-client-core'] as const;

/** The package that holds `cm` in every edition: the one updated when no tool says which owns it. */
export const DEFAULT_LINUX_PACKAGE = 'plasticscm-client-core';

export type LinuxPackageManager = 'apt' | 'dnf' | 'zypper';

/** The tool that told which package owns `cm`, when one did. */
export type PackageOwnerTool = 'dpkg' | 'rpm';

function knownPackage(name: string): string | null {
  return (LINUX_PACKAGES as readonly string[]).includes(name) ? name : null;
}

/** The package `dpkg -S <path>` says owns it, `plasticscm-client-core: /opt/…` (several, comma-separated: the first). */
export function packageFromDpkgSearch(output: string): string | null {
  const owners = /^([^:\n]+?)(?::[\w-]+)?: \//m.exec(output)?.[1] ?? '';
  return knownPackage(owners.split(',')[0]!.trim());
}

/** The package `rpm -qf --queryformat '%{NAME}\n' <path>` says owns it. */
export function packageFromRpmQuery(output: string): string | null {
  return knownPackage(output.trim().split('\n')[0]!.trim());
}

/** A field of /etc/os-release, its quotes removed. */
function osReleaseField(osRelease: string, field: string): string {
  return new RegExp(`^${field}=(.*)$`, 'm').exec(osRelease)?.[1]?.replace(/^["']|["']$/g, '') ?? '';
}

/**
 * The distribution's package manager, from /etc/os-release's `ID` and `ID_LIKE`; else from the tool that knew the
 * package (rpm's distributions use dnf); else apt, which Unity's install instructions start with.
 */
export function linuxPackageManagerOf(osRelease: string, ownerTool: PackageOwnerTool | null): LinuxPackageManager {
  const family = `${osReleaseField(osRelease, 'ID')} ${osReleaseField(osRelease, 'ID_LIKE')}`.split(/\s+/);
  if (family.some((id) => id.includes('suse'))) return 'zypper';
  if (family.some((id) => ['debian', 'ubuntu'].includes(id))) return 'apt';
  if (family.some((id) => ['fedora', 'rhel', 'centos'].includes(id))) return 'dnf';
  return ownerTool === 'rpm' ? 'dnf' : 'apt';
}

/** The command that updates one package, and nothing else, to the latest version Unity's repository has. */
export function linuxUpdateCommand(manager: LinuxPackageManager, pkg: string): string {
  if (manager === 'apt') return `sudo apt-get update && sudo apt-get install --only-upgrade ${pkg}`;
  if (manager === 'dnf') return `sudo dnf upgrade ${pkg}`;
  return `sudo zypper update ${pkg}`;
}
