import { describe, expect, it } from 'vitest';
import { INSTALLER_TARGETS, installerQuestions, unpublishedInstallers, versionJustBefore } from './cmInstallersPublished.ts';

const SITE = 'https://www.plasticscm.com';
const PIN = '11.0.16.10659';

/** The site's answer naming `version` the latest, as it answers (`parseLastVersion` reads it). */
function latest(version: string): string {
  return JSON.stringify({ version, installerUri: `${SITE}/download/downloadinstaller/${version}/plasticscm/windows/cloudedition` });
}

describe('versionJustBefore', () => {
  it('is the pin with its last number one less, so the site names the pin itself when it is the latest', () => {
    expect(versionJustBefore(PIN)).toBe('11.0.16.10658');
  });

  it('refuses a pin ending in 0, which has no version just before it to ask after', () => {
    expect(() => versionJustBefore('11.0.17.0')).toThrow(/11\.0\.17\.0/);
  });
});

describe('installerQuestions', () => {
  it('asks for every edition on Windows, Intel Macs and Apple silicon, after the version just before the pin', () => {
    const questions = installerQuestions(SITE, PIN);
    expect(questions).toHaveLength(INSTALLER_TARGETS.length);
    expect(questions).toContainEqual({ edition: 'cloud', platform: 'macos-arm64', url: `${SITE}/api/lastversion/after/11.0.16.10658/for/cloud/macos-arm64` });
    expect(new Set(questions.map((question) => question.edition))).toEqual(new Set(['cloud', 'enterprise', 'dvcs']));
    expect(new Set(questions.map((question) => question.platform))).toEqual(new Set(['windows', 'macos', 'macos-arm64']));
  });
});

describe('unpublishedInstallers', () => {
  const questions = installerQuestions(SITE, PIN);
  const answering = (body: (url: string) => string) => questions.map((question) => ({ ...question, body: body(question.url) }));

  it('names nothing when every edition and platform has the pin or newer', () => {
    expect(unpublishedInstallers(PIN, answering((url) => (url.includes('/dvcs/') ? latest('11.0.16.10700') : latest(PIN))))).toEqual([]);
  });

  it('names each edition and platform with nothing as new as the pin: an answer of null, or an older version', () => {
    const problems = unpublishedInstallers(
      PIN,
      answering((url) => (url.endsWith('/cloud/macos') ? 'null' : url.endsWith('/enterprise/windows') ? latest('11.0.16.10600') : latest(PIN))),
    );
    expect(problems).toEqual(['cloud on macos: nothing published after 11.0.16.10658', 'enterprise on windows: the latest is 11.0.16.10600']);
  });

  it('names an answer it can’t read', () => {
    expect(unpublishedInstallers(PIN, answering((url) => (url.endsWith('/dvcs/windows') ? '{"error":"Invalid version number"}' : latest(PIN))))).toEqual([
      'dvcs on windows: nothing published after 11.0.16.10658',
    ]);
  });
});
