import type { EventEmitter } from 'node:events';
import type { UnexpectedError } from '@shared/events';
import { textForLog } from '../cm/hideSecrets';

/**
 * Takes every error nothing else caught in the main process: a throw in a callback, a timer or an event listener
 * (`uncaughtException`), and a promise rejected with no one waiting for it (`unhandledRejection`). With a listener of
 * its own, Electron no longer shows its native "A JavaScript error occurred in the main process" dialog, and Node no
 * longer ends the process on a rejection.
 *
 * Each error is logged with its stack, and reported to the user (`report`: the windows' own UI) once per message, so
 * an error that repeats doesn't pile up messages. The app keeps running: the parts that can fail this way end
 * themselves cleanly first (`CmShellSession.guarded` starts its process over), and what is left holds no state that a
 * restart would save (ARCHITECTURE.md "Errors").
 */
export function handleUnexpectedErrors(process: EventEmitter, report: (error: UnexpectedError) => void, log: (text: string) => void = console.error): void {
  const reported = new Set<string>();
  const handle = (kind: string) => (error: unknown) => {
    const unexpected = describeUnexpectedError(error);
    log(`Unexpected error (${kind}): ${unexpected.details}`);
    if (reported.has(unexpected.message)) return;
    reported.add(unexpected.message);
    try {
      report(unexpected);
    } catch (failure) {
      // Reporting must never throw back into this handler, which would leave the error unhandled after all.
      log(`Couldn't report the unexpected error: ${describeUnexpectedError(failure).details}`);
    }
  };
  process.on('uncaughtException', handle('uncaught exception'));
  process.on('unhandledRejection', handle('unhandled rejection'));
}

/** What the user and the logs get of an error: its words and its stack, secrets hidden (`textForLog`). */
export function describeUnexpectedError(error: unknown): UnexpectedError {
  if (!(error instanceof Error)) return { message: textForLog(String(error)), details: textForLog(String(error)) };
  const message = error.message || error.name;
  return { message: textForLog(message), details: textForLog(error.stack ?? `${error.name}: ${message}`) };
}
