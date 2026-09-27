/**
 * Whether hovering may show a tooltip. A key press puts tooltips away until the pointer really moves: the keyboard is
 * driving, and what it changes under a still pointer (a switch re-rendering the branch pill, a closing popover) fires
 * hovers of their own that would bring a tooltip back.
 */
export class TooltipGate {
  private open = true;
  private at: { x: number; y: number } | null = null;

  keyPressed(): void {
    this.open = false;
  }

  /** Chromium also reports a still pointer as moving when what's under it changes: only a new position counts. */
  pointerAt(x: number, y: number): void {
    if (this.at && (this.at.x !== x || this.at.y !== y)) this.open = true;
    this.at = { x, y };
  }

  get allowsHover(): boolean {
    return this.open;
  }
}
