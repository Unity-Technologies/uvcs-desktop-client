import { describe, expect, it } from 'vitest';
import { chooseCm, type CmCandidates } from './chooseCm';

const INSTALLED = '/usr/local/bin/cm';
const MANAGED = '/store/11.0.16.10659/client/cm';
const CANDIDATES: CmCandidates = { environmentPath: undefined, choice: 'automatic', installedPath: INSTALLED, managedPath: MANAGED };

describe('chooseCm', () => {
  it('runs UVCS_CM_PATH over anything else, under either choice', () => {
    expect(chooseCm({ ...CANDIDATES, environmentPath: '/fake/cm' }, 'cm')).toEqual({ source: 'environment', path: '/fake/cm' });
    expect(chooseCm({ ...CANDIDATES, environmentPath: '/fake/cm', choice: 'managed' }, 'cm')).toEqual({ source: 'environment', path: '/fake/cm' });
  });

  it('runs the installed cm by default when one is found', () => {
    expect(chooseCm(CANDIDATES, 'cm')).toEqual({ source: 'installed', path: INSTALLED });
  });

  it('runs the installed cm when the user chose it, and the app’s own when it’s gone', () => {
    expect(chooseCm({ ...CANDIDATES, choice: 'installed' }, 'cm')).toEqual({ source: 'installed', path: INSTALLED });
    expect(chooseCm({ ...CANDIDATES, choice: 'installed', installedPath: null }, 'cm')).toEqual({ source: 'managed', path: MANAGED });
  });

  it('runs the app’s own by default when none is found', () => {
    expect(chooseCm({ ...CANDIDATES, installedPath: null }, 'cm')).toEqual({ source: 'managed', path: MANAGED });
  });

  it('runs the app’s own when the user chose it, even with one installed', () => {
    expect(chooseCm({ ...CANDIDATES, choice: 'managed' }, 'cm')).toEqual({ source: 'managed', path: MANAGED });
    expect(chooseCm({ ...CANDIDATES, choice: 'managed', installedPath: null }, 'cm')).toEqual({ source: 'managed', path: MANAGED });
  });

  it('runs the installed cm where the app has none of its own, under any choice', () => {
    expect(chooseCm({ ...CANDIDATES, managedPath: null }, 'cm')).toEqual({ source: 'installed', path: INSTALLED });
    expect(chooseCm({ ...CANDIDATES, choice: 'managed', managedPath: null }, 'cm')).toEqual({ source: 'installed', path: INSTALLED });
  });

  it('names the bare executable when there is neither, so starting it fails with "not found"', () => {
    expect(chooseCm({ ...CANDIDATES, managedPath: null, installedPath: null }, 'cm.exe')).toEqual({ source: 'installed', path: 'cm.exe' });
  });
});
