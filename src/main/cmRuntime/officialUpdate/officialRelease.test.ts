import { describe, expect, it } from 'vitest';
import { installerFileName, lastVersionUrl, officialPlatformOf, OFFICIAL_SITE, parseLastVersion } from './officialRelease';

/** The answer the download site gives, trimmed of its long lists of changes. */
const ANSWER = JSON.stringify({
  version: '11.0.16.10694',
  releaseDate: '2026-11-19T00:00:00',
  versionsBehind: 60,
  releaseName: '',
  downloadLink: 'https://www.plasticscm.com/download/11.0.16.10694/plasticscm/windows/cloudedition',
  installerUri: 'https://www.plasticscm.com/download/downloadinstaller/11.0.16.10694/plasticscm/windows/cloudedition',
  releaseNotesLink: 'https://www.plasticscm.com/download/releasenotes/11.0.16.10694',
  newFeatures: ['All platforms - Command-line: Restore deleted repositories'],
  fixedBugs: [],
});

describe('officialPlatformOf', () => {
  it('names each OS as the download site does', () => {
    expect(officialPlatformOf('win32', 'x64', false)).toBe('windows');
    expect(officialPlatformOf('win32', 'arm64', false)).toBe('windows');
    expect(officialPlatformOf('darwin', 'x64', false)).toBe('macos');
    expect(officialPlatformOf('darwin', 'arm64', false)).toBe('macos-arm64');
    expect(officialPlatformOf('linux', 'x64', false)).toBe('linux');
  });

  it("takes the Mac's own architecture, Apple silicon even when the app runs under Rosetta", () => {
    expect(officialPlatformOf('darwin', 'x64', true)).toBe('macos-arm64');
  });

  it('has none for another OS', () => {
    expect(officialPlatformOf('freebsd', 'x64', false)).toBeNull();
  });
});

describe('lastVersionUrl', () => {
  it('asks for the latest version after the installed one, of its edition and platform', () => {
    expect(lastVersionUrl(OFFICIAL_SITE, '11.0.16.9000', 'cloud', 'macos-arm64')).toBe('https://www.plasticscm.com/api/lastversion/after/11.0.16.9000/for/cloud/macos-arm64');
  });

  it('asks another site laid out the same way, with or without a slash at its end', () => {
    expect(lastVersionUrl('http://127.0.0.1:4000/', '11.0.16.9000', 'enterprise', 'windows')).toBe('http://127.0.0.1:4000/api/lastversion/after/11.0.16.9000/for/enterprise/windows');
  });
});

describe('parseLastVersion', () => {
  it('reads the version and where its installer downloads from', () => {
    expect(parseLastVersion(ANSWER)).toEqual({
      version: '11.0.16.10694',
      installerUrl: 'https://www.plasticscm.com/download/downloadinstaller/11.0.16.10694/plasticscm/windows/cloudedition',
    });
  });

  it('makes the installer address from the download page when the answer has none', () => {
    const { installerUri: _left, ...older } = JSON.parse(ANSWER) as Record<string, unknown>;
    expect(parseLastVersion(JSON.stringify(older))?.installerUrl).toBe('https://www.plasticscm.com/download/downloadinstaller/11.0.16.10694/plasticscm/windows/cloudedition');
  });

  it('has nothing newer when the site answers null or an empty body', () => {
    expect(parseLastVersion('null')).toBeNull();
    expect(parseLastVersion('')).toBeNull();
  });

  it('has nothing it can use from an answer without a readable version or an installer', () => {
    expect(parseLastVersion(JSON.stringify({ version: 'latest', downloadLink: 'https://www.plasticscm.com/download/x' }))).toBeNull();
    expect(parseLastVersion(JSON.stringify({ version: '11.0.16.10694' }))).toBeNull();
    expect(parseLastVersion('"{\\"error\\":\\"Invalid version number\\"}"')).toBeNull();
  });
});

describe('installerFileName', () => {
  it("takes the file's name from where the download ended up", () => {
    expect(installerFileName('https://d26z97tczqnlef.cloudfront.net/releases/11.0.16.10694/plasticscm/windows/unity-vcs-11.0.16.10694-win.exe')).toBe('unity-vcs-11.0.16.10694-win.exe');
    expect(installerFileName('https://d26z97tczqnlef.cloudfront.net/releases/11.0.16.10694/plasticscm/windows/unity-vcs-on-prem-full-11.0.16.10694-win.exe')).toBe('unity-vcs-on-prem-full-11.0.16.10694-win.exe');
    expect(installerFileName('https://d26z97tczqnlef.cloudfront.net/releases/11.0.16.10694/plasticscm/osx/unity-vcs-on-prem-client-11.0.16.10694-mac-arm.pkg.zip?x=1')).toBe('unity-vcs-on-prem-client-11.0.16.10694-mac-arm.pkg.zip');
  });

  it("refuses anything that isn't an installer's plain name", () => {
    expect(installerFileName('https://cdn.example/releases/readme.html')).toBeNull();
    expect(installerFileName('https://cdn.example/releases/..%2F..%2Fevil.exe')).toBeNull();
    expect(installerFileName('https://cdn.example/')).toBeNull();
  });
});
