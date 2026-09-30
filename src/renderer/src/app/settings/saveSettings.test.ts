import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';

import { queryKeys } from '../../api/queryKeys';
import { shownToasts } from '../../testing/operationOutcome';
import { queryClient } from '../queryClient';
import { saveSettings } from './useSettings';

const shownSettings = () => queryClient.getQueryData<AppSettings>(queryKeys.settings);

afterEach(() => queryClient.clear());

describe('saveSettings', () => {
  it('shows the change at once, before the store confirms it', () => {
    queryClient.setQueryData(queryKeys.settings, { ...DEFAULT_SETTINGS, autoRefresh: true });
    fakeApi.answer('settings.update', () => new Promise(() => {}));

    void saveSettings({ autoRefresh: false });

    expect(shownSettings()).toEqual({ ...DEFAULT_SETTINGS, autoRefresh: false });
  });

  it('then shows what the store saved, which other windows changed too', async () => {
    const stored = { ...DEFAULT_SETTINGS, autoRefresh: false, theme: 'dark' as const };
    fakeApi.answer('settings.update', () => stored);

    await saveSettings({ autoRefresh: false });

    expect(shownSettings()).toEqual(stored);
    expect(fakeApi.calls().at(-1)).toEqual({ method: 'settings.update', args: [{ autoRefresh: false }] });
  });

  it('goes back to what was shown and says so when the store could not save the change', async () => {
    const before = { ...DEFAULT_SETTINGS, autoRefresh: true };
    queryClient.setQueryData(queryKeys.settings, before);
    fakeApi.answer('settings.update', () => {
      throw new Error('The settings file is read-only');
    });

    await saveSettings({ autoRefresh: false });

    expect(shownSettings()).toEqual(before);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't save the settings", detail: 'The settings file is read-only' }]);
  });
});
