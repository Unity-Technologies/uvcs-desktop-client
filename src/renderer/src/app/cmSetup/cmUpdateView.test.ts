import { describe, expect, it } from 'vitest';
import type { OfficialUpdate } from '@shared/domain/officialUpdate';
import { checkAgainOutcome, cmUpdateViewOf, type CmTooOld, type CmUpdateView } from './cmUpdateView';

const TOO_OLD: CmTooOld = { kind: 'installedTooOld', installed: { path: '/usr/local/bin/cm', version: '11.0.16.9000' }, requiredVersion: '11.0.16.10659', updatesBy: 'installer' };
/** Linux, which has no installer: main says it updates by command. */
const byCommand = (status: CmTooOld): CmTooOld => ({ ...status, updatesBy: 'command' });
const NEW = '11.0.16.10694';
const MB = 1024 * 1024;

const withUpdate = (officialUpdate: OfficialUpdate): CmTooOld => ({ ...TOO_OLD, officialUpdate });
const downloading = (installRequested: boolean, totalBytes: number | null = 512 * MB): OfficialUpdate => ({ kind: 'downloading', version: NEW, receivedBytes: 215 * MB, totalBytes, installRequested });

/** Every text a user reads in a view: none says cm, installer, bundle or token. */
function wordsOf(view: CmUpdateView): string[] {
  const texts: string[] = [view.title, view.body];
  if ('hint' in view && view.hint) texts.push(view.hint);
  if ('includedLabel' in view) texts.push(view.includedLabel);
  if (view.kind === 'offer' && view.background) texts.push(view.background);
  return texts;
}

describe('cmUpdateViewOf', () => {
  it('offers Update first, and the included version for now, with both versions on a line of their own', () => {
    const view = cmUpdateViewOf(TOO_OLD, 'none');
    expect(view).toEqual({
      kind: 'offer',
      title: 'Update Unity Version Control',
      body: 'This app needs a newer version of Unity Version Control on this computer.',
      versions: 'Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later',
      hint: 'It takes a minute, and your workspaces aren’t changed.',
      updateLabel: 'Update',
      includedLabel: 'Use the Included Version for Now',
      background: null,
      detail: '/usr/local/bin/cm',
    });
  });

  it('says how far the download in the background is, then that it’s ready', () => {
    expect(cmUpdateViewOf(withUpdate(downloading(false)), 'none')).toMatchObject({ kind: 'offer', background: 'Downloading the update… 41%' });
    expect(cmUpdateViewOf(withUpdate(downloading(false, null)), 'none')).toMatchObject({ kind: 'offer', background: 'Downloading the update…' });
    expect(cmUpdateViewOf(withUpdate({ kind: 'downloaded', version: NEW }), 'none')).toMatchObject({ kind: 'offer', background: 'The update is ready to install.' });
    expect(cmUpdateViewOf(withUpdate({ kind: 'lookingUp', installRequested: false }), 'none')).toMatchObject({ kind: 'offer', background: null });
  });

  it('shows the download the user waits for once Update was pressed, with the version it installs', () => {
    expect(cmUpdateViewOf(withUpdate(downloading(true)), 'none')).toEqual({
      kind: 'updating',
      title: 'Updating Unity Version Control…',
      body: 'Downloading the update…',
      versions: 'Installed: 11.0.16.9000 · Installing: 11.0.16.10694',
      fraction: 215 / 512,
      progress: '215 MB of 512 MB',
    });
    expect(cmUpdateViewOf(withUpdate({ kind: 'lookingUp', installRequested: true }), 'none')).toMatchObject({
      kind: 'updating',
      versions: 'Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later',
      fraction: null,
    });
  });

  it('says the computer may ask for permission while the installer runs', () => {
    expect(cmUpdateViewOf(withUpdate({ kind: 'installing', version: NEW }), 'none')).toEqual({
      kind: 'updating',
      title: 'Updating Unity Version Control…',
      body: 'Your computer may ask for permission.',
      versions: 'Installed: 11.0.16.9000 · Installing: 11.0.16.10694',
      fraction: null,
      progress: null,
    });
  });

  describe('a failure', () => {
    const failed = (failure: Extract<OfficialUpdate, { kind: 'failed' }>['failure']) =>
      cmUpdateViewOf(withUpdate({ kind: 'failed', failure, version: NEW, detail: 'The installer of 11.0.16.10694 ended with exit code 1.' }), 'none');

    it('says it couldn’t, offers Try Again and the included version, the error and path under Details', () => {
      expect(failed('notUpdated')).toEqual({
        kind: 'failed',
        title: 'Couldn’t update Unity Version Control',
        body: 'Close the other Unity Version Control apps, then try again. This computer may also not allow installing programs.',
        versions: 'Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later',
        hint: 'You can keep working with the version included with the app.',
        tryAgainLabel: 'Try Again',
        includedLabel: 'Use the Included Version for Now',
        detail: 'The installer of 11.0.16.10694 ended with exit code 1.\n/usr/local/bin/cm',
      });
    });

    it('says why in plain words for each kind', () => {
      expect(failed('declined').body).toBe('Installing it needs your permission. Try again, and allow it when your computer asks.');
      expect(failed('noUpdate').body).toBe('There’s no newer version to install yet.');
      expect(failed('unreachable').body).toBe('The update couldn’t be downloaded. Check your connection, then try again.');
      expect(failed('notSigned').body).toBe('The download isn’t signed by Unity, so it wasn’t installed. Try again to download a new copy.');
      // macOS: Installer.app closed before it was done, most often cancelled.
      expect(failed('notFinished').body).toBe('The update wasn’t installed. Try again, and finish every step it asks for.');
    });
  });

  it('calls the included version the same on the offer, a failure and Linux’s command', () => {
    const labels = [cmUpdateViewOf(TOO_OLD, 'none'), cmUpdateViewOf(withUpdate({ kind: 'failed', failure: 'declined', version: null, detail: 'x' }), 'none'), cmUpdateViewOf(byCommand(TOO_OLD), 'none')].map(
      (view) => 'includedLabel' in view && view.includedLabel,
    );
    expect(labels).toEqual(['Use the Included Version for Now', 'Use the Included Version for Now', 'Use the Included Version for Now']);
  });

  describe('on Linux', () => {
    it('shows the command that updates it, with Check Again and the included version', () => {
      const view = cmUpdateViewOf(byCommand(withUpdate({ kind: 'byCommand', command: 'sudo dnf upgrade plasticscm-cloud' })), 'none');
      expect(view).toMatchObject({ kind: 'byCommand', commandNote: 'Run this in a terminal:', command: 'sudo dnf upgrade plasticscm-cloud', checkAgainLabel: 'Check Again', checking: false });
    });

    it('waits for the command while it’s being found', () => {
      expect(cmUpdateViewOf(byCommand(TOO_OLD), 'none')).toMatchObject({ kind: 'byCommand', command: null });
    });

    it('says it’s checking, then that it still needs an update when Check Again found the same old version', () => {
      expect(cmUpdateViewOf(byCommand(TOO_OLD), 'checking')).toMatchObject({ checkAgainLabel: 'Checking…', checking: true });
      expect(cmUpdateViewOf(byCommand(TOO_OLD), 'stillTooOld')).toMatchObject({ hint: 'It still needs an update. Update it, then check again.' });
    });
  });

  it('shows the command where main says it updates by command, whatever the window’s OS', () => {
    expect(cmUpdateViewOf(byCommand(TOO_OLD), 'none').kind).toBe('byCommand');
    expect(cmUpdateViewOf(TOO_OLD, 'none').kind).toBe('offer');
  });

  it('never says cm, installer, bundle or token, nor a version outside its own line', () => {
    const views = [
      cmUpdateViewOf(TOO_OLD, 'none'),
      cmUpdateViewOf(withUpdate(downloading(false)), 'none'),
      cmUpdateViewOf(withUpdate(downloading(true)), 'none'),
      cmUpdateViewOf(withUpdate({ kind: 'installing', version: NEW }), 'none'),
      ...(['noUpdate', 'unreachable', 'notSigned', 'declined', 'notUpdated', 'notFinished'] as const).map((failure) =>
        cmUpdateViewOf(withUpdate({ kind: 'failed', failure, version: NEW, detail: '' }), 'none'),
      ),
      cmUpdateViewOf(byCommand(TOO_OLD), 'stillTooOld'),
    ];
    for (const text of views.flatMap(wordsOf)) expect(text).not.toMatch(/\bcm\b|command line|installer|bundle|token|\d+\.\d+/i);
  });
});

describe('checkAgainOutcome', () => {
  it('says it still needs an update only when the screen still asks for one once Check Again read the version', () => {
    expect(checkAgainOutcome('installedTooOld')).toBe('stillTooOld');
    expect(checkAgainOutcome('ready')).toBe('none');
    expect(checkAgainOutcome('installing')).toBe('none');
  });
});
