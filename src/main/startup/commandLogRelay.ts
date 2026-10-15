import type { CommandLogEntry } from '@shared/events';

/**
 * Sends each command `cm` logs on to the windows' command logs. The first screen's reads start before any window
 * exists (`readFirstScreenAhead`), so what is logged until the first windows open waits for them (`windowsOpened`),
 * instead of going to no window.
 */
export class CommandLogRelay {
  private waiting: CommandLogEntry[] | null = [];

  constructor(private readonly send: (entry: CommandLogEntry) => void) {}

  logged(entry: CommandLogEntry): void {
    if (this.waiting) this.waiting.push(entry);
    else this.send(entry);
  }

  /** The first windows are open: they get what was logged so far, and every later entry as it comes. */
  windowsOpened(): void {
    const waiting = this.waiting ?? [];
    this.waiting = null;
    waiting.forEach((entry) => this.send(entry));
  }
}
