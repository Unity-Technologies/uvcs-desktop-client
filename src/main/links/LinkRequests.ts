/**
 * The `uvcs://` links the OS hands the app (`open-url`, a launch's command line, a second launch's), as written: the
 * page that opens one reads it (`parseLink`). A link arriving before the first windows opened, often the one that
 * launched the app, waits for them, so it goes to the window in front of the session, not to one of its own.
 */
export class LinkRequests {
  private readonly waiting: string[] = [];
  private windowsOpen = false;

  /** `open` hands a link to the window in front (`WorkspaceWindows.openLink`). */
  constructor(private readonly open: (link: string) => void) {}

  received(link: string): void {
    if (this.windowsOpen) this.open(link);
    else this.waiting.push(link);
  }

  /** The first windows opened: the links waiting go to them, in the order they came, and the next ones at once. */
  windowsOpened(): void {
    this.windowsOpen = true;
    this.waiting.splice(0).forEach((link) => this.open(link));
  }
}
