import type { UnexpectedError } from '@shared/events';
import { describeWindowError } from './unexpectedErrors';

/** Where an unexpected error goes: the toast that tells the user, and the log file (`system.logUnexpectedError`). */
export interface UnexpectedErrorOutlets {
  tell: (error: UnexpectedError) => void;
  log: (error: UnexpectedError) => void;
}

export interface UnexpectedErrorTeller {
  /** An error of the main process (`unexpectedError`), which main already wrote to the log file itself. */
  mainError(error: UnexpectedError): void;
  /** The page's own error (a window `error`'s error, an `unhandledrejection`'s reason), described as `describeWindowError` does. */
  windowError(reason: unknown, fallbackMessage?: string): void;
}

/**
 * Tells each unexpected error once per message, as one that repeats (a timer, a listener) would flood both the toasts
 * and the log file; the window's own are also logged, then, and what is no failure of the app (`describeWindowError`'s
 * null) goes nowhere.
 */
export function unexpectedErrorTeller({ tell, log }: UnexpectedErrorOutlets): UnexpectedErrorTeller {
  const told = new Set<string>();
  const isNew = (error: UnexpectedError): boolean => {
    if (told.has(error.message)) return false;
    told.add(error.message);
    return true;
  };
  return {
    mainError: (error) => {
      if (isNew(error)) tell(error);
    },
    windowError: (reason, fallbackMessage) => {
      const error = describeWindowError(reason, fallbackMessage);
      if (!error || !isNew(error)) return;
      log(error);
      tell(error);
    },
  };
}
