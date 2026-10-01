import { sendEvent } from '../ipc/sendEvent';
import { handleUnexpectedErrors } from './unexpectedErrors';

// Imported first by the main entry (`main/index.ts`), so the handlers are in place before any other module runs.
handleUnexpectedErrors(process, (error) => sendEvent('unexpectedError', error));
