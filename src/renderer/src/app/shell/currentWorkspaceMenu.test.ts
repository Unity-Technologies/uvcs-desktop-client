import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { MenuEntry } from '../../lib/actions';
import { currentWorkspaceMenu } from './currentWorkspaceMenu';

const ids = (entries: MenuEntry[]): string[] => entries.flatMap((entry) => (typeof entry === 'object' && 'id' in entry ? [entry.id] : []));

describe('currentWorkspaceMenu', () => {
  it('offers choosing what to download in a partial workspace', () => {
    expect(ids(currentWorkspaceMenu('/w/game', { name: 'game', kind: 'partial' }))).toContain('chooseDownloads');
  });

  it('offers it nowhere else: a standard or dynamic workspace has every file, and an unknown kind may too', () => {
    for (const kind of ['standard', 'dynamic', undefined] as const) {
      expect(ids(currentWorkspaceMenu('/w/game', { name: 'game', kind }))).not.toContain('chooseDownloads');
    }
  });
});
