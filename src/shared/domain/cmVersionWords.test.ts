import { describe, expect, it } from 'vitest';
import { installedAndNeededText, installedVersionText, neededVersionText, versionAndNeededText, versionText } from './cmVersionWords';

describe('cmVersionWords', () => {
  it('names each version the same way everywhere', () => {
    expect(versionText('11.0.16.10700')).toBe('Version 11.0.16.10700');
    expect(installedVersionText('11.0.16.10700')).toBe('Installed: 11.0.16.10700');
    expect(neededVersionText('11.0.16.10659')).toBe('Needed: 11.0.16.10659 or later');
  });

  it('puts a version too old and the one needed on one line', () => {
    expect(installedAndNeededText('11.0.16.9000', '11.0.16.10659')).toBe('Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later');
    expect(versionAndNeededText('11.0.16.9000', '11.0.16.10659')).toBe('Version 11.0.16.9000 · Needed: 11.0.16.10659 or later');
  });
});
