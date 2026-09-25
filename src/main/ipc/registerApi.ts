import { ipcMain } from 'electron';
import type { UvcsApi } from '@shared/api';
import { INVOKE_CHANNEL, type InvokeRequest, type InvokeResponse, type RemoteError } from '@shared/ipc';
import { CmError } from '../cm/CmError';
import { runForCaller } from './caller';

type AnyMethod = (...args: unknown[]) => Promise<unknown>;

/** Serves every `<area>.<method>` of the API over a single IPC channel. */
export function registerApi(api: UvcsApi): void {
  const methods = new Map<string, AnyMethod>();
  for (const [area, service] of Object.entries(api)) {
    for (const [name, method] of Object.entries(service as Record<string, AnyMethod>)) {
      methods.set(`${area}.${name}`, method);
    }
  }

  ipcMain.handle(INVOKE_CHANNEL, async (event, request: InvokeRequest): Promise<InvokeResponse> => {
    const method = methods.get(request.method);
    if (!method) return { ok: false, error: { message: `Unknown API method ${request.method}` } };

    try {
      return { ok: true, value: await runForCaller(event.sender, () => method(...request.args)) };
    } catch (error) {
      return { ok: false, error: toRemoteError(error) };
    }
  });
}

function toRemoteError(error: unknown): RemoteError {
  if (error instanceof CmError) return { message: error.message, command: error.command };
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}
