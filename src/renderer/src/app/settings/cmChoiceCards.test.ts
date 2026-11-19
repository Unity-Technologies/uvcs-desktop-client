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

  it('warns when the installed one is older than the app’s own', () => {
    const [, installed] = cmChoiceCards({ pinnedVersion: '11.0.16.10659', installed: { ...INSTALLED, version: '11.0.16.9000' }, source: 'installed' });
    expect(installed).toMatchObject({ warning: true, tip: 'Older than the one included with the app: newer features may not work with it. /usr/local/bin/cm' });
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
