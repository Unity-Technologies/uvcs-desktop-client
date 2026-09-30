import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';

const uvcs = await vi.hoisted(async () => (await import('../../lib/testing/fakeWindow')).installFakeWindow());

import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../queryClient';
import { saveSettings } from './useSettings';

const shownSettings = () => queryClient.getQueryData<AppSettings>(queryKeys.settings);

afterEach(() => queryClient.clear());

describe('saveSettings', () => {
  it('shows the change at once, before the store confirms it', () => {
    queryClient.setQueryData(queryKeys.settings, { ...DEFAULT_SETTINGS, autoRefresh: true });
    uvcs.answer = () => new Promise(() => {});

    void saveSettings({ autoRefresh: false });

    expect(shownSettings()).toEqual({ ...DEFAULT_SETTINGS, autoRefresh: false });
  });

  it('then shows what the store saved, which other windows changed too', async () => {
    const stored = { ...DEFAULT_SETTINGS, autoRefresh: false, theme: 'dark' as const };
    uvcs.answer = () => ({ ok: true, value: stored });

    await saveSettings({ autoRefresh: false });

    expect(shownSettings()).toEqual(stored);
    expect(uvcs.calls.at(-1)).toEqual({ method: 'settings.update', args: [{ autoRefresh: false }] });
  });
});
