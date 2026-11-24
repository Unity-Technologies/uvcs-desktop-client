import { describe, expect, it } from 'vitest';
import { installedCmNoteOf, updateCardOf, waitingCardOf } from './updateCardStatus';

describe('updateCardOf', () => {
  it('shows an update downloading, even one no one asked for', () => {
    const downloading = { state: 'downloading', version: '1.2.0', percent: 30 } as const;
    expect(updateCardOf(downloading, null, false)).toBe(downloading);
  });

  it('shows a downloaded update until that version is put off, and a newer one again', () => {
    const ready = { state: 'ready', version: '1.2.0', install: 'restart' } as const;
    expect(updateCardOf(ready, null, false)).toBe(ready);
    expect(updateCardOf(ready, '1.2.0', false)).toBeNull();
    expect(updateCardOf({ ...ready, version: '1.3.0' }, '1.2.0', false)).toEqual({ ...ready, version: '1.3.0' });
  });

  it('keeps showing an update waiting for an operation to install, even a version put off', () => {
    const waiting = { state: 'waitingToInstall', version: '1.2.0', install: 'restart', waitingFor: 'operation' } as const;

    expect(updateCardOf(waiting, '1.2.0', false)).toEqual(waiting);
  });

  it('leaves checks and their answers to the About dialog and the toasts', () => {
    expect(updateCardOf({ state: 'checking' }, null, false)).toBeNull();
    expect(updateCardOf({ state: 'upToDate' }, null, false)).toBeNull();
    expect(updateCardOf({ state: 'failed', error: 'x' }, null, false)).toBeNull();
  });

  it('steps aside while a dialog shows the update, and comes back after', () => {
    const ready = { state: 'ready', version: '1.2.0', install: 'restart' } as const;
    expect(updateCardOf(ready, null, true)).toBeNull();
    expect(updateCardOf({ state: 'downloading', version: '1.2.0', percent: 30 }, null, true)).toBeNull();
    expect(updateCardOf(ready, null, false)).toBe(ready);
  });
});

describe('installedCmNoteOf', () => {
  it('says nothing when the update needs nothing of the installed one', () => {
    expect(installedCmNoteOf(undefined)).toBeNull();
  });

  it('says the update updates the installed one too, naming both versions', () => {
    expect(installedCmNoteOf({ installedVersion: '11.0.16.10659', neededVersion: '11.0.16.10700', by: 'installer' })).toEqual({
      text: 'This update also updates the Unity Version Control installed on this computer.',
      versions: 'Installed: 11.0.16.10659 · Needed: 11.0.16.10700 or later',
    });
  });

  it('on Linux, says the command comes after the restart', () => {
    expect(installedCmNoteOf({ installedVersion: '11.0.16.10659', neededVersion: '11.0.16.10700', by: 'command' })?.text).toBe(
      'After the restart, the app shows the command that updates the Unity Version Control installed on this computer.',
    );
  });
});

describe('waitingCardOf', () => {
  it('waits for an operation to finish', () => {
    expect(waitingCardOf({ state: 'waitingToInstall', version: '1.2.0', install: 'restart', waitingFor: 'operation' })).toEqual({
      title: 'Unity Version Control 1.2.0 installs once the operation finishes.',
      text: null,
    });
  });

  it('waits for the installed one’s installer, which may ask for permission, then restarts', () => {
    expect(waitingCardOf({ state: 'waitingToInstall', version: '1.2.0', install: 'restart', waitingFor: 'installedCm' })).toEqual({
      title: 'Updating the Unity Version Control installed on this computer…',
      text: 'Your computer may ask for permission. Then the app restarts into version 1.2.0.',
    });
  });
});
