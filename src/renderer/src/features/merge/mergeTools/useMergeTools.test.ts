import { fakeApi } from '../../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { shownToasts } from '../../../testing/operationOutcome';
import { addCustomMergeTool } from './useMergeTools';

const shownSettings = () => queryClient.getQueryData<AppSettings>(queryKeys.settings);
const tool = { name: 'Diffy', executable: '/usr/local/bin/diffy', args: ['{base}', '{yours}', '{incoming}', '{result}'] };

afterEach(() => {
  queryClient.clear();
  vi.useRealTimers();
});

describe('addCustomMergeTool', () => {
  it('saves the tool as the preferred one and returns its id', async () => {
    vi.useFakeTimers({ now: 1234 });
    queryClient.setQueryData(queryKeys.settings, DEFAULT_SETTINGS);
    fakeApi.answer('settings.update', (changes: Partial<AppSettings>) => ({ ...DEFAULT_SETTINGS, ...changes }));

    const id = await addCustomMergeTool(tool);

    expect(id).toBe('custom:1234');
    expect(shownSettings()).toMatchObject({ customMergeTools: [{ ...tool, id: 'custom:1234' }], mergeTool: 'custom:1234' });
  });

  it('returns no id when the store could not save it, so nothing picks a tool that does not exist', async () => {
    queryClient.setQueryData(queryKeys.settings, DEFAULT_SETTINGS);
    fakeApi.answer('settings.update', () => {
      throw new Error('The settings file is read-only');
    });

    const id = await addCustomMergeTool(tool);

    expect(id).toBeUndefined();
    expect(shownSettings()).toEqual(DEFAULT_SETTINGS);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't save the settings", detail: 'The settings file is read-only' }]);
  });
});
