import { appLog } from '../diagnostics/appLog';
import { sendEvent } from '../ipc/sendEvent';
import { handleUnexpectedErrors } from './unexpectedErrors';

// Imported first by the main entry (`main/index.ts`), so the handlers are in place before any other module runs.
// Each one is written to the console (development, the smoke test) every time, and to the log file a user sends with a
// bug report once per message.
handleUnexpectedErrors(
  process,
  (error) => sendEvent('unexpectedError', error),
  console.error,
  (text) => appLog.write(text),
);
