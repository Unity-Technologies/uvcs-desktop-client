import { describe, expect, it } from 'vitest';
import { dropIntentOf, dropOverlayWording } from './dropOverlayWording';

describe('dropIntentOf', () => {
  it('opens a workspace folder and creates one in any other folder', () => {
    expect(dropIntentOf({ path: '/ws', isWorkspace: true })).toBe('open');
    expect(dropIntentOf({ path: '/projects/new', isWorkspace: false })).toBe('create');
  });

  it('does not know before main answers, or when it can not tell (Windows, Linux, a file)', () => {
    expect(dropIntentOf(undefined)).toBe('unknown');
    expect(dropIntentOf(null)).toBe('unknown');
  });
});

describe('dropOverlayWording', () => {
  it('says a workspace folder opens, and that Shift opens it in a new window', () => {
    expect(dropOverlayWording('open', false)).toEqual({
      icon: 'folder',
      title: 'Open workspace',
      line: 'Drop here to open.',
      shift: { verb: 'Hold', purpose: 'to open in a new window.' },
    });
  });

  it('says where it opens while Shift is held', () => {
    expect(dropOverlayWording('open', true)).toMatchObject({ icon: 'newWindow', title: 'Open in a new window', shift: { verb: 'Release' } });
  });

  it('says another folder becomes a new workspace, with no word about Shift', () => {
    const wording = { icon: 'create', title: 'Create workspace', line: 'Drop here to create a new workspace.', shift: null };
    expect(dropOverlayWording('create', false)).toEqual(wording);
    expect(dropOverlayWording('create', true)).toEqual(wording);
  });

  it('keeps to open or create while it does not know', () => {
    expect(dropOverlayWording('unknown', false)).toMatchObject({ title: 'Open or create a workspace', line: 'Drop a folder here.' });
    expect(dropOverlayWording('unknown', true)).toMatchObject({ title: 'Open in a new window', line: 'Drop a folder here.' });
  });
});
