import { describe, expect, it } from 'vitest';
import { cmChoiceCards, cmChoiceNote } from './cmChoiceCards';

const INSTALLED = { path: '/usr/local/bin/cm', version: '11.0.16.10659' };

describe('cmChoiceCards', () => {
  it('checks the one included with the app, by default', () => {
    const [managed, installed] = cmChoiceCards({ pinnedVersion: '11.0.16.10659', installed: INSTALLED, source: 'managed' });
    expect(managed).toEqual({ choice: 'managed', label: 'Included with the app', description: 'Version 11.0.16.10659, updated with the app', disabled: false, selected: true, warning: false });
    expect(installed).toMatchObject({ choice: 'installed', description: 'Version 11.0.16.10659 · /usr/local/bin/cm', selected: false, disabled: false, warning: false });
  });

  it('checks the installed one when it runs', () => {
    expect(cmChoiceCards({ pinnedVersion: '11.0.16.10659', installed: INSTALLED, source: 'installed' }).map((card) => card.selected)).toEqual([false, true]);
  });

  it('takes an installed one newer than the app’s own', () => {
    const [, installed] = cmChoiceCards({ pinnedVersion: '11.0.16.10659', installed: { ...INSTALLED, version: '11.0.16.10700' }, source: 'managed' });
    expect(installed).toMatchObject({ disabled: false, warning: false });
  });

  it('can’t choose an installed one older than the app’s own, and says what it needs', () => {
    const [, installed] = cmChoiceCards({ pinnedVersion: '11.0.16.10659', installed: { ...INSTALLED, version: '11.0.16.9000' }, source: 'managed' });
    expect(installed).toEqual({
      choice: 'installed',
      label: 'Installed on this computer',
      description: 'Version 11.0.16.9000 · needs 11.0.16.10659 or later',
      tip: 'Older than the one included with the app. Update it to use it. /usr/local/bin/cm',
      disabled: true,
      selected: false,
      warning: true,
    });
  });

  // Where it has none (Linux on Arm), `system.cmVersion` stops an older one before any window shows Settings.
  it('compares no versions where the app has none of its own', () => {
    const [, installed] = cmChoiceCards({ pinnedVersion: null, installed: { ...INSTALLED, version: '11.0.16.9000' }, source: 'installed' });
    expect(installed).toMatchObject({ disabled: false, warning: false });
  });

  it('can’t choose an installed one that isn’t there, nor while it’s looked for', () => {
    expect(cmChoiceCards({ pinnedVersion: '11.0.16.10659', installed: null, source: 'managed' })[1]).toMatchObject({ description: 'Not found on this computer', disabled: true });
    expect(cmChoiceCards({ pinnedVersion: '11.0.16.10659', installed: undefined, source: 'managed' })[1]).toMatchObject({ description: 'Looking…', disabled: true });
  });

  it('can’t choose the included one where the app has none of its own', () => {
    expect(cmChoiceCards({ pinnedVersion: null, installed: INSTALLED, source: 'installed' })[0]).toMatchObject({ description: 'Not available on this computer', disabled: true, selected: false });
  });

  it('shows its own downloading while the installed one keeps running, and a failure to try again', () => {
    const facts = { pinnedVersion: '11.0.16.10659', installed: INSTALLED, source: 'installed' as const };
    expect(cmChoiceCards({ ...facts, switchingToOwn: { kind: 'downloading', fraction: 0.42 } })[0]).toMatchObject({
      description: 'Downloading version 11.0.16.10659… 42%',
      disabled: true,
      selected: false,
    });
    expect(cmChoiceCards({ ...facts, switchingToOwn: { kind: 'downloading', fraction: null } })[0]?.description).toBe('Downloading version 11.0.16.10659…');
    expect(cmChoiceCards({ ...facts, switchingToOwn: { kind: 'failed', failure: 'offline', detail: 'net::ERR_INTERNET_DISCONNECTED' } })[0]).toMatchObject({
      description: 'Couldn’t download it. Choose it to try again.',
      tip: 'net::ERR_INTERNET_DISCONNECTED',
      disabled: false,
      warning: true,
    });
  });

  it('checks neither when UVCS_CM_PATH runs, and says why', () => {
    expect(cmChoiceCards({ pinnedVersion: '11.0.16.10659', installed: INSTALLED, source: 'environment' }).map((card) => card.selected)).toEqual([false, false]);
    expect(cmChoiceNote('environment')).toBe('UVCS_CM_PATH is set: the app runs that one, whatever is chosen here.');
    expect(cmChoiceNote('managed')).toBeNull();
  });
});
