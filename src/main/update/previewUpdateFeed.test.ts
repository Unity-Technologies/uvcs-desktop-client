import { describe, expect, it, vi } from 'vitest';
import type { UpdateStatus } from '@shared/domain/appUpdate';
import { AppUpdates } from './AppUpdates';
import { previewUpdateFeed, previewUpdateFile, previewUpdateOf } from './previewUpdateFeed';

const file = {
  version: '0.2.5',
  releaseDate: '2026-10-30T12:00:00Z',
  releaseNotes: [
    { version: '0.2.5', note: '<h2>New</h2><h3>Tools</h3>' },
    { version: '0.2.4', note: null },
  ],
};

describe('a preview update, for seeing What’s New while developing', () => {
  it('reads the update a file describes', () => {
    expect(previewUpdateOf(file)).toEqual({
      version: '0.2.5',
      files: [],
      releaseDate: '2026-10-30T12:00:00Z',
      releaseNotes: [
        { version: '0.2.5', note: '<h2>New</h2><h3>Tools</h3>' },
        { version: '0.2.4', note: null },
      ],
    });
  });

  it('is named by its variable only in an unpackaged app, and only when the variable names a file', () => {
    const env = { UVCS_PREVIEW_UPDATE: '/tmp/update.json' };

    expect(previewUpdateFile(false, env)).toBe('/tmp/update.json');
    expect(previewUpdateFile(true, env)).toBeUndefined();
    expect(previewUpdateFile(false, { UVCS_PREVIEW_UPDATE: '' })).toBeUndefined();
    expect(previewUpdateFile(false, { UVCS_PREVIEW_UPDATE: '  ' })).toBeUndefined();
    expect(previewUpdateFile(false, {})).toBeUndefined();
  });

  it('refuses a file that names no version', () => {
    expect(() => previewUpdateOf({ releaseNotes: [] })).toThrow(/"version"/);
    expect(() => previewUpdateOf([])).toThrow(/"version"/);
  });

  it('is found and ready at once, with its notes, and installing it only says it does not', async () => {
    const feed = previewUpdateFeed(previewUpdateOf(file));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pushed: UpdateStatus[] = [];
    const updates = new AppUpdates({
      loadFeed: async () => feed,
      packaged: true,
      needsManualInstall: async () => false,
      downloadInstaller: async () => '',
      installerOf: () => null,
      openInstaller: async () => undefined,
      writesRunning: () => false,
      writesFinished: async () => undefined,
      beforeRestart: () => undefined,
      push: (status) => pushed.push(status),
      logFailure: () => undefined,
    });

    await updates.check();

    expect(updates.status()).toEqual({ state: 'ready', version: '0.2.5', install: 'restart' });
    expect(updates.releaseNotes()).toEqual([{ version: '0.2.5', html: '<h2>New</h2><h3>Tools</h3>', releaseDate: '2026-10-30T12:00:00Z' }]);
    await updates.install();
    expect(warn).toHaveBeenCalledWith("[updates] UVCS_PREVIEW_UPDATE: a preview update doesn't install.");
    warn.mockRestore();
  });
});
