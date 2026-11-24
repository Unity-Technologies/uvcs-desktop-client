import { describe, expect, it } from 'vitest';
import { linuxPackageManagerOf, linuxUpdateCommand, packageFromDpkgSearch, packageFromRpmQuery } from './linuxUpdateCommand';

const UBUNTU = 'NAME="Ubuntu"\nVERSION_ID="24.04"\nID=ubuntu\nID_LIKE=debian\n';
const FEDORA = 'NAME="Fedora Linux"\nVERSION_ID=41\nID=fedora\n';
const ROCKY = 'NAME="Rocky Linux"\nID="rocky"\nID_LIKE="rhel centos fedora"\n';
const OPENSUSE = 'NAME="openSUSE Leap"\nID="opensuse-leap"\nID_LIKE="suse opensuse"\n';

describe('packageFromDpkgSearch', () => {
  it('reads the package that owns the file, as `dpkg -S` prints it', () => {
    expect(packageFromDpkgSearch('plasticscm-client-core: /opt/plasticscm5/client/cm\n')).toBe('plasticscm-client-core');
    expect(packageFromDpkgSearch('plasticscm-cloud:amd64: /opt/plasticscm5/client/cm\n')).toBe('plasticscm-cloud');
    expect(packageFromDpkgSearch('plasticscm-complete, plasticscm-client-core: /opt/plasticscm5/client/cm\n')).toBe('plasticscm-complete');
  });

  it("knows only Unity Version Control's packages", () => {
    expect(packageFromDpkgSearch('dpkg-query: no path found matching pattern /usr/local/bin/cm\n')).toBeNull();
    expect(packageFromDpkgSearch('some-other-tool: /opt/plasticscm5/client/cm\n')).toBeNull();
  });
});

describe('packageFromRpmQuery', () => {
  it("reads the package's name, as `rpm -qf --queryformat '%{NAME}\\n'` prints it", () => {
    expect(packageFromRpmQuery('plasticscm-client-core\n')).toBe('plasticscm-client-core');
  });

  it('has none for a file no package owns', () => {
    expect(packageFromRpmQuery('file /usr/local/bin/cm is not owned by any package\n')).toBeNull();
  });
});

describe('linuxPackageManagerOf', () => {
  it("names the distribution's package manager from /etc/os-release", () => {
    expect(linuxPackageManagerOf(UBUNTU, null)).toBe('apt');
    expect(linuxPackageManagerOf('ID=debian\n', null)).toBe('apt');
    expect(linuxPackageManagerOf(FEDORA, null)).toBe('dnf');
    expect(linuxPackageManagerOf(ROCKY, null)).toBe('dnf');
    expect(linuxPackageManagerOf(OPENSUSE, null)).toBe('zypper');
  });

  it("falls back on the tool that knew the package, then on apt's, the one the docs install with", () => {
    expect(linuxPackageManagerOf('ID=arch\n', 'rpm')).toBe('dnf');
    expect(linuxPackageManagerOf('', 'dpkg')).toBe('apt');
    expect(linuxPackageManagerOf('', null)).toBe('apt');
  });
});

describe('linuxUpdateCommand', () => {
  it('updates only that package, with each package manager', () => {
    expect(linuxUpdateCommand('apt', 'plasticscm-cloud')).toBe('sudo apt-get update && sudo apt-get install --only-upgrade plasticscm-cloud');
    expect(linuxUpdateCommand('dnf', 'plasticscm-complete')).toBe('sudo dnf upgrade plasticscm-complete');
    expect(linuxUpdateCommand('zypper', 'plasticscm-client-core')).toBe('sudo zypper update plasticscm-client-core');
  });
});
