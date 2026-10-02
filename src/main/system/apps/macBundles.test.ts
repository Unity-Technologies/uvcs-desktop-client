import { describe, expect, it } from 'vitest';
import { bundleQueryArgs, parseBundleLocations } from './macBundles';

describe('bundleQueryArgs', () => {
  it('asks Spotlight for every identifier in one query, naming the identifier each answer matched', () => {
    expect(bundleQueryArgs(['com.microsoft.VSCode', 'dev.zed.Zed'])).toEqual([
      '-attr',
      'kMDItemCFBundleIdentifier',
      "kMDItemCFBundleIdentifier == 'com.microsoft.VSCode' || kMDItemCFBundleIdentifier == 'dev.zed.Zed'",
    ]);
  });
});

describe('parseBundleLocations', () => {
  const home = '/Users/me';

  it('reads each bundle and the identifier it matched, spaces in its name included', () => {
    const output = [
      '/Applications/Visual Studio Code.app   kMDItemCFBundleIdentifier = com.microsoft.VSCode',
      '/System/Applications/Utilities/Terminal.app   kMDItemCFBundleIdentifier = com.apple.Terminal',
      '/Users/me/Apps/Zed.app   kMDItemCFBundleIdentifier = dev.zed.Zed',
      '',
    ].join('\n');
    expect(parseBundleLocations(output, home)).toEqual(
      new Map([
        ['com.microsoft.VSCode', '/Applications/Visual Studio Code.app'],
        ['com.apple.Terminal', '/System/Applications/Utilities/Terminal.app'],
        ['dev.zed.Zed', '/Users/me/Apps/Zed.app'],
      ]),
    );
  });

  it('prefers the copy in /Applications, then ~/Applications, over others', () => {
    const output = [
      '/Users/me/Downloads/Visual Studio Code.app   kMDItemCFBundleIdentifier = com.microsoft.VSCode',
      '/Users/me/Applications/Visual Studio Code.app   kMDItemCFBundleIdentifier = com.microsoft.VSCode',
      '/Applications/Visual Studio Code.app   kMDItemCFBundleIdentifier = com.microsoft.VSCode',
    ].join('\n');
    expect(parseBundleLocations(output, home).get('com.microsoft.VSCode')).toBe('/Applications/Visual Studio Code.app');
  });

  it("leaves out copies the user doesn't run: in the Trash, on a disk image, translocated, in Library caches", () => {
    const output = [
      '/Users/me/.Trash/Zed.app   kMDItemCFBundleIdentifier = dev.zed.Zed',
      '/Volumes/Zed/Zed.app   kMDItemCFBundleIdentifier = dev.zed.Zed',
      '/private/var/folders/x/AppTranslocation/1/d/Zed.app   kMDItemCFBundleIdentifier = dev.zed.Zed',
      '/Users/me/Library/Caches/Zed/Zed.app   kMDItemCFBundleIdentifier = dev.zed.Zed',
    ].join('\n');
    expect(parseBundleLocations(output, home)).toEqual(new Map());
  });

  it('ignores lines that name no bundle, such as Spotlight warnings, and CRLF line ends', () => {
    expect(parseBundleLocations('mdfind: warning\r\n/Applications/Zed.app   kMDItemCFBundleIdentifier = dev.zed.Zed\r\n', home)).toEqual(new Map([['dev.zed.Zed', '/Applications/Zed.app']]));
  });
});
