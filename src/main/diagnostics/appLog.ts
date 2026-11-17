import { join } from 'node:path';
import { app } from 'electron';
import { DiagnosticLog } from './DiagnosticLog';

/** The log's file name in the OS's logs folder for the app (`app.getPath('logs')`), which Help ▸ Show Log Files opens. */
const LOG_FILE_NAME = 'uvcs-desktop.log';

/** 5 MB a file, three files: days of a busy user's commands, and never more than 15 MB on their disk. */
const LOG_FILE_BYTES = 5 * 1024 * 1024;
const EARLIER_LOG_FILES = 2;

/**
 * Where the log goes: the OS's logs folder for the app. An app run from the repository (development, `npm start`, the
 * smoke test) logs in its user data folder instead, which a test points at a temp folder (`--user-data-dir`): on macOS
 * the logs folder is outside it (`~/Library/Logs`), and would mix a test's commands into the installed app's log.
 */
const logsFolder = app.isPackaged ? app.getPath('logs') : join(app.getPath('userData'), 'logs');

/**
 * The app's one log (ARCHITECTURE.md "The log file"), made as the main process starts, so the unexpected errors'
 * handlers (`installUnexpectedErrorHandlers`, main's first import) write to it too.
 */
export const appLog = new DiagnosticLog({ file: join(logsFolder, LOG_FILE_NAME), maxBytes: LOG_FILE_BYTES, keptFiles: EARLIER_LOG_FILES });
