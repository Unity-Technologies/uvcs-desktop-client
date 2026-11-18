import type { UvcsApi } from '@shared/api';
import type { SignInProblem } from '@shared/domain/signIn';
import type { FailedCommand, RemoteError } from '@shared/ipc';

/** An error raised by the main process, typically a failed `cm` command. */
export class ApiError extends Error {
  /** The failed `cm` command behind this error, if any. */
  readonly command?: FailedCommand;
  /** Set when the command was refused, or failed, as its server needs a sign-in (docs/features/accounts.md). */
  readonly signIn?: SignInProblem;

  constructor(error: RemoteError) {
    super(error.message);
    this.name = 'ApiError';
    this.command = error.command;
    this.signIn = error.signIn;
  }
}

function createAreaClient(area: string): object {
  return new Proxy(
    {},
    {
      get: (_target, method: string) => {
        // Keep the proxy from looking like a promise when something awaits it.
        if (method === 'then') return undefined;
        return async (...args: unknown[]) => {
          const response = await window.uvcs.invoke({ method: `${area}.${method}`, args });
          if (!response.ok) throw new ApiError(response.error);
          return response.value;
        };
      },
    },
  );
}

/** Typed access to the main process: `api.branches.list(...)`. */
export const api = new Proxy({} as UvcsApi, {
  get: (cache, area: string) => {
    const areas = cache as unknown as Record<string, object>;
    areas[area] ??= createAreaClient(area);
    return areas[area];
  },
});
