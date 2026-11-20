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

  it('never focuses anything with a plain focus(), only as the pointer does', () => {
    expect(canvas).not.toMatch(/\.focus\(/);
    expect(canvas).toMatch(/focusAs\([^)]*'pointer'\)/);
  });
});
