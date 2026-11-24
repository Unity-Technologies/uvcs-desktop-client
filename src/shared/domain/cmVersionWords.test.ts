import { describe, expect, it } from 'vitest';
import { includedVersionText, installedAndNeededText, installedVersionText, neededVersionText } from './cmVersionWords';

describe('cmVersionWords', () => {
  it('names each version the same way everywhere', () => {
    expect(installedVersionText('11.0.16.10700')).toBe('Installed: 11.0.16.10700');
    expect(neededVersionText('11.0.16.10659')).toBe('Needed: 11.0.16.10659 or later');
    expect(includedVersionText('11.0.16.10659')).toBe('Included: 11.0.16.10659');
  });

  it('puts an installed version and the one needed on one line', () => {
    expect(installedAndNeededText('11.0.16.9000', '11.0.16.10659')).toBe('Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later');
  });
});
