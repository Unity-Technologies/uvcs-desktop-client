import { ipcMain } from 'electron';
import type { UvcsApi } from '@shared/api';
import { INVOKE_CHANNEL, type InvokeRequest, type InvokeResponse, type RemoteError } from '@shared/ipc';
import { clipForLog, MAX_LOGGED_COMMAND_LINE, MAX_LOGGED_OUTPUT } from '@shared/clipForLog';
import { CmError } from '../cm/CmError';
import { apiMethods } from './apiMethods';
import { runForCaller } from './caller';
import type { EarlyCalls } from './EarlyCalls';

/**
 * Serves every `<area>.<method>` of the API over a single IPC channel. A call the main process already made for the
 * page (`EarlyCalls`) answers with that call's answer.
 */
export function registerApi(api: UvcsApi, early?: EarlyCalls): void {
  const methods = apiMethods(api);

  ipcMain.handle(INVOKE_CHANNEL, async (event, request: InvokeRequest): Promise<InvokeResponse> => {
    const method = methods.get(request.method);
    if (!method) return { ok: false, error: { message: `Unknown API method ${request.method}` } };

    try {
      const answer = early?.take(request.method, request.args) ?? runForCaller(event.sender, () => method(...request.args));
      return { ok: true, value: await answer };
    } catch (error) {
      return { ok: false, error: toRemoteError(error) };
    }
  });
}

function toRemoteError(error: unknown): RemoteError {
  if (error instanceof CmError) return { message: error.message, command: clippedCommand(error.command) };
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}

/**
 * A failed command as the window gets it: clipped as the command log clips it. A failed update of 50,000 files would
 * send megabytes of progress lines, kept by the page as long as the error is.
 */
function clippedCommand(command: CmError['command']): CmError['command'] {
  return {
    ...command,
    commandLine: clipForLog(command.commandLine, MAX_LOGGED_COMMAND_LINE),
    output: clipForLog(command.output, MAX_LOGGED_OUTPUT, 'ends'),
  };
}
