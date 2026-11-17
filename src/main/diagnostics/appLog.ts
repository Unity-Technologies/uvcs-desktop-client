import { join } from 'node:path';
import { app } from 'electron';
import { DiagnosticLog } from './DiagnosticLog';

/** The log's file name in the OS's logs folder for the app (`app.getPath('logs')`), which Help ▸ Show Log Files opens. */
export const LOG_FILE_NAME = 'uvcs-desktop.log';

/** 5 MB a file, three files: days of a busy user's commands, and never more than 15 MB on their disk. */
const LOG_FILE_BYTES = 5 * 1024 * 1024;
const EARLIER_LOG_FILES = 2;

/**
 * The app's one log (ARCHITECTURE.md "The log file"), made as the main process starts, so the unexpected errors'
 * handlers (`installUnexpectedErrorHandlers`, main's first import) write to it too.
 */
export const appLog = new DiagnosticLog({ file: join(app.getPath('logs'), LOG_FILE_NAME), maxBytes: LOG_FILE_BYTES, keptFiles: EARLIER_LOG_FILES });
