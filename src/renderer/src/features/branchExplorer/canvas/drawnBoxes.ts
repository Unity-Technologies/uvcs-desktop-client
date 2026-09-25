import type { Point } from './curves';

/** Something drawn in the last frame that the pointer can land on, in world coordinates. */
export interface DrawnBox<T> {
  item: T;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where things were drawn in the last frame, so the pointer hits what is on screen (sticky headers,
 * captions cut to their room). The boxes are reused from frame to frame: drawing allocates nothing.
 */
export class DrawnBoxes<T> {
  private readonly boxes: DrawnBox<T>[] = [];
  private count = 0;

  reset(): void {
    this.count = 0;
  }

  add(item: T, x: number, y: number, width: number, height: number): void {
    const box = this.boxes[this.count];
    if (box) {
      box.item = item;
      box.x = x;
      box.y = y;
      box.width = width;
      box.height = height;
    } else {
      this.boxes.push({ item, x, y, width, height });
    }
    this.count++;
  }

  /** The box under a point; the last drawn wins, as it is on top. */
  at(point: Point): DrawnBox<T> | null {
    for (let index = this.count - 1; index >= 0; index--) {
      const box = this.boxes[index]!;
      if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) return box;
    }
    return null;
  }

  /** The box drawn for an item, if it was drawn. */
  find(matches: (item: T) => boolean): DrawnBox<T> | null {
    for (let index = 0; index < this.count; index++) if (matches(this.boxes[index]!.item)) return this.boxes[index]!;
    return null;
  }
}
