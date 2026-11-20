import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A click on the graph or the Timeline focuses the graph from code. A plain `focus()` there shows the keyboard ring
 * once any key was pressed in the window (`lib/focusRing.ts`): the graph sat framed in blue after an ordinary click.
 * The pointer's focus goes through `focusAs(…, 'pointer')`, ringless.
 */
describe('the Branch Explorer graph focused by the pointer', () => {
  const canvas = readFileSync(join(__dirname, 'GraphCanvas.tsx'), 'utf8');

  it('never focuses its container with a plain focus()', () => {
    expect(canvas).not.toMatch(/containerRef\.current\?\.focus\(\)/);
  });

  it("focuses it as the pointer does, ringless", () => {
    expect(canvas.match(/focusAs\(containerRef\.current, 'pointer'\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
