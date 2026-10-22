import { fakeApi } from '../../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { shownToasts } from '../../../testing/operationOutcome';
import { addCustomMergeTool, removeCustomMergeTool } from './useMergeTools';

const shownSettings = () => queryClient.getQueryData<AppSettings>(queryKeys.settings);
const tool = { name: 'Diffy', executable: '/usr/local/bin/diffy', args: ['{base}', '{yours}', '{incoming}', '{result}'] };

afterEach(() => {
  queryClient.clear();
  vi.useRealTimers();
});

describe('addCustomMergeTool', () => {
  it('saves the tool, without picking it for any file, and returns its id', async () => {
    vi.useFakeTimers({ now: 1234 });
    queryClient.setQueryData(queryKeys.settings, DEFAULT_SETTINGS);
    fakeApi.answer('settings.update', (changes: Partial<AppSettings>) => ({ ...DEFAULT_SETTINGS, ...changes }));

    const id = await addCustomMergeTool(tool);

    expect(id).toBe('custom:1234');
    expect(shownSettings()).toMatchObject({ customMergeTools: [{ ...tool, id: 'custom:1234' }], mergeTool: 'auto' });
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

describe('removeCustomMergeTool', () => {
  it('forgets the tool everywhere it was picked: the files it opened open as if it never was', async () => {
    const mine = { ...tool, id: 'custom:1' };
    const kept = { id: 'shaders', patterns: ['.shader'], toolId: 'rider' };
    queryClient.setQueryData(queryKeys.settings, {
      ...DEFAULT_SETTINGS,
      customMergeTools: [mine],
      mergeTool: 'custom:1',
      unityMergeTool: 'custom:1',
      mergeToolArgs: { 'custom:1': ['{result}'], rider: ['{result}'] },
      mergeToolRules: [{ id: 'docs', patterns: ['.md'], toolId: 'custom:1' }, kept],
    });
    fakeApi.answer('settings.update', (changes: Partial<AppSettings>) => ({ ...shownSettings()!, ...changes }));

    await removeCustomMergeTool('custom:1');

    expect(shownSettings()).toMatchObject({ customMergeTools: [], mergeTool: 'auto', unityMergeTool: 'others', mergeToolArgs: { rider: ['{result}'] }, mergeToolRules: [kept] });
  });
});
