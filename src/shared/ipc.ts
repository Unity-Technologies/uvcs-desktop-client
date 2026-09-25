export const INVOKE_CHANNEL = 'uvcs:invoke';
export const EVENT_CHANNEL = 'uvcs:event';

export interface InvokeRequest {
  method: string;
  args: unknown[];
}

export type InvokeResponse =
  | { ok: true; value: unknown }
  | { ok: false; error: RemoteError };

export interface RemoteError {
  message: string;
  commandLine?: string;
}
