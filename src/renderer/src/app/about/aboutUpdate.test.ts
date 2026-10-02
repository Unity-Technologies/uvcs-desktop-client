import { describe, expect, it } from 'vitest';
import { aboutUpdateAction, aboutUpdateLine, describePlatform } from './aboutUpdate';

describe('aboutUpdateLine', () => {
  it('shows a spinner while checking or downloading', () => {
    expect(aboutUpdateLine({ state: 'checking' })).toEqual({ text: 'Checking for updates…', tone: 'muted', busy: true });
    expect(aboutUpdateLine({ state: 'downloading', version: '1.2.0', percent: 42 })).toEqual({
      text: 'Downloading version 1.2.0… 42%',
      tone: 'accent',
      busy: true,
    });
  });

  it('tells a downloaded update from one whose installer the user opens', () => {
    expect(aboutUpdateLine({ state: 'ready', version: '1.2.0', install: 'restart' }).text).toBe('Version 1.2.0 is ready to install.');
    expect(aboutUpdateLine({ state: 'ready', version: '1.2.0', install: 'installer' }).text).toBe(
      'Version 1.2.0 is downloaded. Open its installer to finish.',
    );
  });

  it('says why a check failed, in the error tone', () => {
    expect(aboutUpdateLine({ state: 'failed', error: 'No published release is available to update from yet.' })).toEqual({
      text: "Couldn't check for updates: No published release is available to update from yet.",
      tone: 'error',
      busy: false,
    });
  });
});

describe('aboutUpdateAction', () => {
  it('installs a downloaded update, by restarting or by opening its installer', () => {
    expect(aboutUpdateAction({ state: 'ready', version: '1.2.0', install: 'restart' })).toEqual({ kind: 'install', label: 'Restart & Install', enabled: true });
    expect(aboutUpdateAction({ state: 'ready', version: '1.2.0', install: 'installer' })).toEqual({ kind: 'install', label: 'Open Installer', enabled: true });
  });

  it('waits, with a spinner and its button off, while an operation finishes before installing', () => {
    const waiting = { state: 'waitingToInstall', version: '1.2.0', install: 'restart' } as const;

    expect(aboutUpdateLine(waiting)).toEqual({ text: 'Version 1.2.0 installs once the operation finishes.', tone: 'accent', busy: true });
    expect(aboutUpdateAction(waiting)).toEqual({ kind: 'install', label: 'Restart & Install', enabled: false });
  });

  it('checks, except while a check or download is under way or in a development build', () => {
    expect(aboutUpdateAction({ state: 'idle' })).toEqual({ kind: 'check', enabled: true });
    expect(aboutUpdateAction({ state: 'failed', error: 'x' })).toEqual({ kind: 'check', enabled: true });
    expect(aboutUpdateAction({ state: 'checking' })).toEqual({ kind: 'check', enabled: false });
    expect(aboutUpdateAction({ state: 'downloading', version: '1.2.0', percent: 3 })).toEqual({ kind: 'check', enabled: false });
    expect(aboutUpdateAction({ state: 'unavailable' })).toEqual({ kind: 'check', enabled: false });
  });
});

describe('describePlatform', () => {
  it('names each OS as people do', () => {
    expect(describePlatform('darwin', 'arm64')).toBe('macOS · arm64');
    expect(describePlatform('win32', 'x64')).toBe('Windows · x64');
    expect(describePlatform('linux', 'x64')).toBe('Linux · x64');
    expect(describePlatform('freebsd', 'x64')).toBe('freebsd · x64');
  });
});
