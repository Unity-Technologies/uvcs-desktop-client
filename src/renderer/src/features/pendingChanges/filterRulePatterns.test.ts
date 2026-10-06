import { describe, expect, it } from 'vitest';
import { itemRulePatterns, sharedExtension } from './filterRulePatterns';

describe('itemRulePatterns', () => {
  it('gives each item a rule from the workspace root', () => {
    expect(itemRulePatterns(['Packages/manifest.json'])).toEqual(['/Packages/manifest.json']);
    expect(itemRulePatterns(['Assets', 'Packages/manifest.json'])).toEqual(['/Assets', '/Packages/manifest.json']);
  });

  it('leaves out the items a selected folder already covers', () => {
    expect(
      itemRulePatterns(['plugin/ProjectSettings', 'plugin/ProjectSettings/AudioManager.asset', 'plugin/ProjectSettings/Deep/Tag.asset', 'plugin/Assets']),
    ).toEqual(['/plugin/ProjectSettings', '/plugin/Assets']);
  });

  it('keeps an item whose name only starts like a selected folder', () => {
    expect(itemRulePatterns(['Assets', 'AssetsBackup/a.png'])).toEqual(['/Assets', '/AssetsBackup/a.png']);
  });

  it('writes each item once, and Unicode names as they are', () => {
    expect(itemRulePatterns(['Música/canción.wav', 'Música/canción.wav'])).toEqual(['/Música/canción.wav']);
  });
});

describe('sharedExtension', () => {
  it('is the extension all the items have', () => {
    expect(sharedExtension(['a/AudioManager.asset', 'b/TagManager.asset'])).toBe('.asset');
  });

  it('is null when they differ, or some have none', () => {
    expect(sharedExtension(['a.asset', 'b.json'])).toBeNull();
    expect(sharedExtension(['ProjectSettings', 'a.asset'])).toBeNull();
    expect(sharedExtension(['ProjectSettings'])).toBeNull();
  });
});
