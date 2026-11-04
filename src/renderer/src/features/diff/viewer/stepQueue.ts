/** A press of next (1) or previous (-1). */
export type StepDirection = 1 | -1;

/**
 * The presses made before the selected file's diff opened at its arrival (while it's read, drawn, or just drawn), each
 * tagged with the file it was meant for (its versions' key, `diffContentsKey`). One per diff header
 * (`SteppedDiffFrame`): the header puts presses in while no diff of the selected file is drawn, the diff its own until
 * it opened, and the diff takes them once it did, one at a time. Presses meant for another file are dropped: picking
 * a file while another loads opens it at its top.
 */
export class StepQueue {
  private presses: { key: string; direction: StepDirection }[] = [];

  push(key: string, direction: StepDirection): void {
    this.presses.push({ key, direction });
  }

  /** The next press kept for the file `key` names; those kept for any other are dropped. */
  take(key: string): StepDirection | undefined {
    this.presses = this.presses.filter((press) => press.key === key);
    return this.presses.shift()?.direction;
  }

  clear(): void {
    this.presses = [];
  }
}
