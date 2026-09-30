import { describe, expect, it, vi } from 'vitest';
import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import type { UvcsApi } from '@shared/api';
import { INVOKE_CHANNEL, type InvokeRequest, type InvokeResponse } from '@shared/ipc';
import { CmError } from '../cm/CmError';
import { callerId, currentCaller } from './caller';
import { registerApi } from './registerApi';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

type Handler = (event: IpcMainInvokeEvent, request: InvokeRequest) => Promise<InvokeResponse>;

const FAILED_COMMAND = { commandLine: 'cm switch br:/main/gone', exitCode: 1, output: 'Error: The branch does not exist.', logEntryId: 12 };

function window(id: number, destroyed = false): WebContents {
  return { id, isDestroyed: () => destroyed } as unknown as WebContents;
}

/** Registers `api` and returns how a window invokes it over the one channel. */
function served(api: Record<string, Record<string, (...args: never[]) => Promise<unknown>>>) {
  vi.mocked(ipcMain.handle).mockClear();
  registerApi(api as unknown as UvcsApi);
  const [[channel, handler]] = vi.mocked(ipcMain.handle).mock.calls as unknown as [[string, Handler]];
  expect(channel).toBe(INVOKE_CHANNEL);
  return (method: string, args: unknown[] = [], sender = window(1)) => handler({ sender } as IpcMainInvokeEvent, { method, args });
}

describe('registerApi', () => {
  it('dispatches each area.method to its service with the arguments, and answers its value', async () => {
    const list = vi.fn(async (workspacePath: string, filter: object) => [workspacePath, filter]);
    const invoke = served({ branches: { list }, labels: { list: async () => [] } });

    expect(await invoke('branches.list', ['/wk', { limit: 5 }])).toEqual({ ok: true, value: ['/wk', { limit: 5 }] });
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('answers an unknown method as a failure instead of throwing', async () => {
    const invoke = served({ branches: { list: async () => [] } });

    expect(await invoke('branches.drop')).toEqual({ ok: false, error: { message: 'Unknown API method branches.drop' } });
  });

  it('sends a failed cm command with the error, for the command log and the error details', async () => {
    const invoke = served({
      workspaces: {
        switchTo: async () => {
          throw new CmError('The branch does not exist.', FAILED_COMMAND);
        },
      },
    });

    expect(await invoke('workspaces.switchTo')).toEqual({ ok: false, error: { message: 'The branch does not exist.', command: FAILED_COMMAND } });
  });

  it('sends any other failure as its message only', async () => {
    const invoke = served({
      a: { error: async () => Promise.reject(new TypeError('Cannot read properties of undefined')) },
      b: { thrown: async () => Promise.reject('plain text') },
    });

    expect(await invoke('a.error')).toEqual({ ok: false, error: { message: 'Cannot read properties of undefined' } });
    expect(await invoke('b.thrown')).toEqual({ ok: false, error: { message: 'plain text' } });
  });

  it('runs each call on behalf of the window that made it, across awaits', async () => {
    const invoke = served({
      windows: {
        whoAsked: async () => {
          await Promise.resolve();
          return [callerId(), currentCaller()?.id];
        },
      },
    });

    const [first, second] = await Promise.all([invoke('windows.whoAsked', [], window(3)), invoke('windows.whoAsked', [], window(4))]);

    expect(first).toEqual({ ok: true, value: [3, 3] });
    expect(second).toEqual({ ok: true, value: [4, 4] });
  });
});

describe('caller', () => {
  it('has no caller outside an API call, so window-only methods fail', () => {
    expect(currentCaller()).toBeUndefined();
    expect(() => callerId()).toThrow('This can only be asked from a window.');
  });

  it('sends nothing back to a window that closed during its call', async () => {
    const closed = window(5, true);
    const invoke = served({ system: { caller: async () => [currentCaller(), callerId()] } });

    expect(await invoke('system.caller', [], closed)).toEqual({ ok: true, value: [undefined, 5] });
  });
});
