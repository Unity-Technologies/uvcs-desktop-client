import '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { followPointerDrag } from './pointerDrag';

function pointer(type: 'pointermove' | 'pointerup' | 'pointercancel', clientX: number, clientY: number): void {
  window.dispatchEvent(Object.assign(new Event(type), { clientX, clientY }));
}

/** Presses at (100, 100) and tells what the drag reported. */
function press(): string[] {
  const told: string[] = [];
  followPointerDrag(
    { clientX: 100, clientY: 100 },
    { onDrag: (dx, dy) => told.push(`drag ${dx},${dy}`), onDragEnd: () => told.push('end'), onClick: (up) => told.push(`click at ${up.clientX}`) },
  );
  return told;
}

describe('followPointerDrag', () => {
  it('takes a press that barely moved for a click', () => {
    const told = press();
    pointer('pointermove', 102, 102);
    pointer('pointerup', 102, 102);

    expect(told).toEqual(['click at 102']);
  });

  it('drags once the pointer went far enough, by how far it moved since the last move, from the press', () => {
    const told = press();
    pointer('pointermove', 102, 100);
    pointer('pointermove', 106, 100);
    pointer('pointermove', 110, 95);
    pointer('pointerup', 110, 95);

    expect(told).toEqual(['drag 6,0', 'drag 4,-5', 'end']);
  });

  it('stops following the pointer once it comes up', () => {
    const told = press();
    pointer('pointerup', 100, 100);
    pointer('pointermove', 150, 150);
    pointer('pointerup', 150, 150);

    expect(told).toEqual(['click at 100']);
  });

  it('ends a drag when the system takes the pointer, and clicks nothing for a press', () => {
    const dragged = press();
    pointer('pointermove', 110, 100);
    pointer('pointercancel', 110, 100);
    pointer('pointermove', 150, 100);
    expect(dragged).toEqual(['drag 10,0', 'end']);

    const pressed = press();
    pointer('pointercancel', 100, 100);
    pointer('pointerup', 100, 100);
    expect(pressed).toEqual([]);
  });
});
