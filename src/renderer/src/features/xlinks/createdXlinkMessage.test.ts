import { describe, expect, it, vi } from 'vitest';
import { createdXlinkMessage, loadedXlinkMessage } from './createdXlinkMessage';

const ways = { workspaceKind: 'standard' as const, loadAgain: () => undefined, chooseDownloads: () => undefined };

describe('How creating an xlink ends', () => {
  it('names the changeset it was checked in as, its files loaded', () => {
    expect(createdXlinkMessage('code/lib', { kind: 'loaded', changesetId: 3 }, ways)).toEqual({ title: 'Created xlink code/lib', detail: 'Checked in as changeset 3.' });
  });

  it('says where the other changes are when they didn’t come back on their own', () => {
    expect(createdXlinkMessage('code/lib', { kind: 'loaded', changesetId: 3, changesWaitIn: 7 }, ways)).toEqual({
      kind: 'info',
      title: 'Created xlink code/lib',
      detail: 'Checked in as changeset 3. Your other changes didn’t come back on their own: Changes offers them back.',
    });
  });

  it('names the app’s own way to its files when it wasn’t checked in, never as an error: the xlink exists', () => {
    expect(createdXlinkMessage('lib', { kind: 'notCheckedIn', reason: 'The server is unreachable' }, ways)).toEqual({
      kind: 'info',
      title: 'Created xlink lib, not checked in',
      detail: 'The server is unreachable. To see its files, check it in from Changes, then open its folder in Files and choose Load its files on it.',
    });
  });

  it('offers to load its files again when only they didn’t load', () => {
    const load = vi.fn();
    const ending = createdXlinkMessage('lib', { kind: 'notLoaded', changesetId: 3, reason: 'The server is unreachable' }, { ...ways, loadAgain: load });

    expect(ending).toMatchObject({
      kind: 'info',
      title: 'Created xlink lib',
      detail: 'Checked in as changeset 3, but its files didn’t load: The server is unreachable. To try again, open its folder in Files and choose Load its files on it.',
      action: { label: 'Load its files' },
    });
    ending.action!.run();
    expect(load).toHaveBeenCalledOnce();
  });
});

describe('How creating an xlink ends in a partial workspace, which downloads it with Choose what to download…', () => {
  const inPartial = { ...ways, workspaceKind: 'partial' as const };

  it('offers to choose it for download once checked in, never Load its files, which a partial workspace refuses', () => {
    const choose = vi.fn();
    const ending = createdXlinkMessage('lib', { kind: 'notLoaded', changesetId: 3, reason: 'refused' }, { ...inPartial, chooseDownloads: choose });

    expect(ending).toMatchObject({
      kind: 'info',
      title: 'Created xlink lib',
      detail: 'Checked in as changeset 3. To download its files, pick it in Choose what to download….',
      action: { label: 'Choose what to download…' },
    });
    ending.action!.run();
    expect(choose).toHaveBeenCalledOnce();
  });

  it('names the same way when it wasn’t checked in', () => {
    expect(createdXlinkMessage('lib', { kind: 'notCheckedIn', reason: 'The server is unreachable' }, inPartial)).toEqual({
      kind: 'info',
      title: 'Created xlink lib, not checked in',
      detail: 'The server is unreachable. To see its files, check it in from Changes, then pick it in Choose what to download….',
    });
  });
});

describe('How loading an xlink’s files ends', () => {
  it('says they loaded, and where the other changes are when they didn’t come back on their own', () => {
    expect(loadedXlinkMessage('lib', {})).toEqual({ title: 'Loaded the files of xlink lib' });
    expect(loadedXlinkMessage('lib', { changesWaitIn: 7 })).toEqual({
      kind: 'info',
      title: 'Loaded the files of xlink lib',
      detail: 'Your other changes didn’t come back on their own: Changes offers them back.',
    });
  });
});
