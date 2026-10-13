import { describe, expect, it } from 'vitest';
import { loadsPackagesFromOutside } from './unityPackages';

const manifest = (dependencies: Record<string, string>): string => JSON.stringify({ dependencies });

describe('loadsPackagesFromOutside', () => {
  it("tells a project that loads a package from a folder outside its own Packages, where Unity reads it as it lies", () => {
    expect(loadsPackagesFromOutside(manifest({ 'com.studio.art': 'file:../../Shared/com.studio.art' }))).toBe(true);
    expect(loadsPackagesFromOutside(manifest({ 'com.studio.art': 'file:C:/Studio/com.studio.art' }))).toBe(true);
    expect(loadsPackagesFromOutside(manifest({ 'com.studio.art': 'file:/Users/art/com.studio.art' }))).toBe(true);
  });

  it("doesn't for registry packages, tarballs Unity unpacks into its cache, or a folder inside Packages", () => {
    expect(loadsPackagesFromOutside(manifest({ 'com.unity.render-pipelines.universal': '17.0.3', 'com.unity.ugui': '2.0.0' }))).toBe(false);
    expect(loadsPackagesFromOutside(manifest({ 'com.studio.art': 'file:../Shared/com.studio.art-1.0.0.tgz' }))).toBe(false);
    expect(loadsPackagesFromOutside(manifest({ 'com.studio.art': 'file:com.studio.art' }))).toBe(false);
  });

  it("doesn't for text that isn't a manifest", () => {
    expect(loadsPackagesFromOutside(null)).toBe(false);
    expect(loadsPackagesFromOutside('{')).toBe(false);
  });
});
