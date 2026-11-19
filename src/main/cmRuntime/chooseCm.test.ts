import { describe, expect, it } from 'vitest';
import { chooseCm, type CmCandidates } from './chooseCm';

const CANDIDATES: CmCandidates = { environmentPath: undefined, choice: 'managed', installedPath: '/usr/local/bin/cm', managedPath: '/store/11.0.16.10659/client/cm' };

describe('chooseCm', () => {
  it('runs the app’s own cm by default, even with one installed', () => {
    expect(chooseCm(CANDIDATES, 'cm')).toEqual({ source: 'managed', path: '/store/11.0.16.10659/client/cm' });
  });

  it('runs UVCS_CM_PATH over anything else', () => {
    expect(chooseCm({ ...CANDIDATES, environmentPath: '/fake/cm', choice: 'installed' }, 'cm')).toEqual({ source: 'environment', path: '/fake/cm' });
  });

  it('runs the installed cm when the user chose it', () => {
    expect(chooseCm({ ...CANDIDATES, choice: 'installed' }, 'cm')).toEqual({ source: 'installed', path: '/usr/local/bin/cm' });
  });

  it('runs the app’s own when the user chose the installed one and it’s gone', () => {
    expect(chooseCm({ ...CANDIDATES, choice: 'installed', installedPath: null }, 'cm').source).toBe('managed');
  });

  it('runs the installed cm where the app has none of its own', () => {
    expect(chooseCm({ ...CANDIDATES, managedPath: null }, 'cm')).toEqual({ source: 'installed', path: '/usr/local/bin/cm' });
  });

  it('names the bare executable when there is neither, so starting it fails with "not found"', () => {
    expect(chooseCm({ ...CANDIDATES, managedPath: null, installedPath: null }, 'cm.exe')).toEqual({ source: 'installed', path: 'cm.exe' });
  });
});
