import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RELEASES_REPOSITORY, releaseFileUrl } from './releaseFeed';

const ROOT = join(__dirname, '..', '..', '..');
const builderConfig = readFileSync(join(ROOT, 'electron-builder.yml'), 'utf8');

/** The files outside the code that link to the app's repository: its page, issues, releases and security advisories. */
const FILES_LINKING_THE_REPOSITORY = ['package.json', 'README.md', 'SECURITY.md', join('.github', 'ISSUE_TEMPLATE', 'config.yml')];

describe('the release feed', () => {
  it("is the repository electron-builder publishes to, where electron-updater looks for updates", () => {
    const publish = builderConfig.slice(builderConfig.indexOf('\npublish:'));
    expect(publish).toMatch(/^\s+provider: github$/m);
    expect(publish).toMatch(new RegExp(`^\\s+owner: ${RELEASES_REPOSITORY.owner}$`, 'm'));
    expect(publish).toMatch(new RegExp(`^\\s+repo: ${RELEASES_REPOSITORY.repo}$`, 'm'));
  });

  it.each(FILES_LINKING_THE_REPOSITORY)('is the repository %s links to', (file) => {
    const linked = readFileSync(join(ROOT, file), 'utf8').match(new RegExp(`github\\.com/[\\w.-]+/${RELEASES_REPOSITORY.repo}`, 'g'));
    expect(linked).not.toBeNull();
    expect(new Set(linked)).toEqual(new Set([`github.com/${RELEASES_REPOSITORY.owner}/${RELEASES_REPOSITORY.repo}`]));
  });

  it('is the Unity Technologies repository', () => {
    expect(RELEASES_REPOSITORY).toEqual({ owner: 'Unity-Technologies', repo: 'uvcs-desktop-client' });
  });

  it('names each file of the release tagged with its version', () => {
    expect(releaseFileUrl('1.2.0', 'UnityVersionControl-1.2.0-macOS-arm64.dmg')).toBe(
      'https://github.com/Unity-Technologies/uvcs-desktop-client/releases/download/v1.2.0/UnityVersionControl-1.2.0-macOS-arm64.dmg',
    );
  });
});
