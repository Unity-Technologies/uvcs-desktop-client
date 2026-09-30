import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RELEASES_REPOSITORY, releaseFileUrl } from './releaseFeed';

const builderConfig = readFileSync(join(__dirname, '..', '..', '..', 'electron-builder.yml'), 'utf8');

describe('the release feed', () => {
  it("is the repository electron-builder publishes to, where electron-updater looks for updates", () => {
    const publish = builderConfig.slice(builderConfig.indexOf('\npublish:'));
    expect(publish).toMatch(/^\s+provider: github$/m);
    expect(publish).toMatch(new RegExp(`^\\s+owner: ${RELEASES_REPOSITORY.owner}$`, 'm'));
    expect(publish).toMatch(new RegExp(`^\\s+repo: ${RELEASES_REPOSITORY.repo}$`, 'm'));
  });

  it('names each file of the release tagged with its version', () => {
    expect(releaseFileUrl('1.2.0', 'UnityVersionControl-1.2.0-macOS-arm64.dmg')).toBe(
      'https://github.com/danipen/uvcs-desktop-client/releases/download/v1.2.0/UnityVersionControl-1.2.0-macOS-arm64.dmg',
    );
  });
});
