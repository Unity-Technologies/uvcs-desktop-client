type Key = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'repeat'>;

/**
 * Tells a press and release of Alt alone, which opens the menus on Windows, from Alt held for a chord (Alt+←), a
 * click (Alt+click) or AltGr typing a character (Ctrl+Alt to the page).
 */
export class AltTap {
  private armed = false;

  keyDown(event: Key): void {
    this.armed = event.key === 'Alt' && !event.ctrlKey && !event.metaKey && !event.shiftKey && (this.armed || !event.repeat);
  }

  /** True when this release ends a tap. */
  keyUp(event: Key): boolean {
    const tapped = this.armed && event.key === 'Alt';
    this.armed = false;
    return tapped;
  }

  /** A click or leaving the window while Alt is down. */
  cancel(): void {
    this.armed = false;
  }
}
