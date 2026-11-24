import { describe, expect, it } from 'vitest';
import { cmUnavailableView } from './cmUnavailableView';

describe('cmUnavailableView', () => {
  it('never asks to install anything when the app’s own cm doesn’t start', () => {
    expect(cmUnavailableView({ source: 'managed' }, false)).toMatchObject({ title: 'Unity Version Control didn’t start', offersInstall: false, versions: null });
  });

  it('offers to install it when the installed one is missing', () => {
    expect(cmUnavailableView({ source: 'installed' }, false)).toMatchObject({ title: 'Unity Version Control is required', offersInstall: true, versions: null });
    expect(cmUnavailableView({ source: 'environment' }, false).offersInstall).toBe(true);
  });

  it('names both versions when the installed one is too old', () => {
    const installedTooOld = { installed: { path: '/usr/bin/cm', version: '11.0.16.9000' }, requiredVersion: '11.0.16.10659' };
    expect(cmUnavailableView({ source: 'installed', installedTooOld }, false).versions).toBe('Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later');
  });

  it('offers Check Again, saying when it checks', () => {
    expect(cmUnavailableView({ source: 'installed' }, false).checkAgainLabel).toBe('Check Again');
    expect(cmUnavailableView({ source: 'managed' }, true).checkAgainLabel).toBe('Checking…');
  });
});
