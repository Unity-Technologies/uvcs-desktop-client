import { entryEnding } from '@shared/commandEnding';
import type { CommandLogEntry } from '@shared/events';

/** What the log's first record of a launch says: the app, the OS and Electron (`startedText`). */
export interface LaunchInfo {
  appVersion: string;
  platform: NodeJS.Platform;
  osRelease: string;
  arch: string;
  electronVersion: string;
}

/** How a process Electron started ended: a window's page, the GPU, a utility (`render-process-gone`, `child-process-gone`). */
export interface ProcessEnding {
  reason: string;
  exitCode: number;
}

/** The reason Electron gives a process that ended as it should, which the log leaves out. */
const CLEAN_EXIT = 'clean-exit';

/** What follows the first line of a record (a stack, a command's output) is indented, so each record starts with its time. */
const CONTINUATION_INDENT = '    ';

/**
 * One record of the log: the local time with its offset from UTC (as `cm`'s own log writes local times, so the two read
 * side by side), then the text, every line after the first indented. `offsetMinutes` is `Date.getTimezoneOffset`'s.
 */
export function logRecord(when: Date, offsetMinutes: number, text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').trimEnd().split('\n');
  return `${localTimestamp(when, offsetMinutes)} ${lines.join(`\n${CONTINUATION_INDENT}`)}\n`;
}

/** `2026-11-17 12:40:36.123 +01:00`: the time where the user is, and how far that is from UTC. */
function localTimestamp(when: Date, offsetMinutes: number): string {
  const local = new Date(when.getTime() - offsetMinutes * 60_000).toISOString();
  const east = -offsetMinutes;
  const hours = Math.floor(Math.abs(east) / 60);
  const minutes = Math.abs(east) % 60;
  return `${local.slice(0, 10)} ${local.slice(11, 23)} ${east < 0 ? '-' : '+'}${pad(hours)}:${pad(minutes)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** The launch's first record. */
export function startedText(info: LaunchInfo): string {
  return `Unity Version Control ${info.appVersion} started · ${info.platform} ${info.osRelease} ${info.arch} · Electron ${info.electronVersion}`;
}

/** The `cm` the app runs, once it answered its version. */
export function cmFoundText(version: string, executable: string): string {
  return `cm ${version} at ${executable}`;
}

/**
 * A command of the command log (or an issue tracker's request), as the log keeps it: its line, where it ran, how long
 * it took, and, when it failed, how it ended (`entryEnding`) and the output the command log kept of it.
 */
export function commandText(entry: CommandLogEntry): string {
  const where = entry.cwd ? ` · in ${entry.cwd}` : '';
  const head = `${entry.commandLine}${where} · ${entry.durationMs} ms`;
  if (entry.exitCode === 0) return head;
  return entry.output ? `${head} · ${entryEnding(entry)}\n${entry.output}` : `${head} · ${entryEnding(entry)}`;
}

/** A window's page that ended unexpectedly (it crashed, was killed, ran out of memory); null when it ended as it should. */
export function pageGoneText(ending: ProcessEnding): string | null {
  return ending.reason === CLEAN_EXIT ? null : `A window's page ended: ${ending.reason}, exit code ${ending.exitCode}`;
}

/** Another of Electron's processes (the GPU, a utility) that ended unexpectedly; null when it ended as it should. */
export function processGoneText(ending: ProcessEnding & { type: string; name?: string }): string | null {
  if (ending.reason === CLEAN_EXIT) return null;
  const name = ending.name ? ` (${ending.name})` : '';
  return `The ${ending.type} process${name} ended: ${ending.reason}, exit code ${ending.exitCode}`;
}
