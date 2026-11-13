import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { MenuEntry } from '../../lib/actions';
import { currentWorkspaceMenu } from './currentWorkspaceMenu';

const ids = (entries: MenuEntry[]): string[] => entries.flatMap((entry) => (typeof entry === 'object' && 'id' in entry && entry.id ? [entry.id] : []));

describe('currentWorkspaceMenu', () => {
  const onBranch = { kind: 'branch', name: '/main' } as const;

  it('offers choosing what to download in a partial workspace, and in a standard one on a branch', () => {
    for (const kind of ['partial', 'standard'] as const) {
      expect(ids(currentWorkspaceMenu('/w/game', { name: 'game', kind, selector: onBranch }))).toContain('chooseDownloads');
    }
  });

  it('offers it nowhere else: a dynamic workspace, an unknown kind, or a standard one off a branch', () => {
    expect(ids(currentWorkspaceMenu('/w/game', { name: 'game', kind: 'dynamic', selector: onBranch }))).not.toContain('chooseDownloads');
    expect(ids(currentWorkspaceMenu('/w/game', { name: 'game', selector: onBranch }))).not.toContain('chooseDownloads');
    expect(ids(currentWorkspaceMenu('/w/game', { name: 'game', kind: 'standard', selector: { kind: 'label', name: 'v1' } }))).not.toContain('chooseDownloads');
  });

  it('offers downloading the whole branch in a partial workspace only', () => {
    expect(ids(currentWorkspaceMenu('/w/game', { name: 'game', kind: 'partial', selector: onBranch }))).toContain('downloadWholeBranch');
    for (const kind of ['standard', 'dynamic', undefined] as const) {
      expect(ids(currentWorkspaceMenu('/w/game', { name: 'game', kind, selector: onBranch }))).not.toContain('downloadWholeBranch');
    }
  });
});
