import type { CommandLogEntry } from '@shared/events';
import type { TrackerRequestLog } from './TrackerHttp';

/**
 * A tracker's request as the command log shows it (`CommandLogEntry.source`): its method, host and path, never its
 * query, headers or body; a failure keeps only the `TrackerError`'s words, never the answer's body.
 */
export function trackerLogEntry(request: TrackerRequestLog): Omit<CommandLogEntry, 'id'> {
  return {
    commandLine: `${request.method} ${request.host}${request.path}`,
    cwd: '',
    startedAt: request.startedAt,
    durationMs: request.durationMs,
    exitCode: request.failure ? 1 : 0,
    viaShell: false,
    output: request.failure ?? '',
    source: 'tracker',
    ...(request.httpStatus !== undefined && { httpStatus: request.httpStatus }),
  };
}
