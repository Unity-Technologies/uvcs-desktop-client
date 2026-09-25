import { describe, expect, it } from 'vitest';
import { sampleHistory } from './graphFixtures';
import { layoutGraph } from './layoutGraph';
import { startingChangeset } from './navigateGraph';

const layout = layoutGraph(sampleHistory());

describe('startingChangeset', () => {
  it("starts from a selected branch's latest changeset", () => {
    expect(startingChangeset(layout, '/main/a', 3)).toBe(5);
  });

  it('otherwise starts from the workspace changeset, then from the latest one', () => {
    expect(startingChangeset(layout, null, 3)).toBe(3);
    expect(startingChangeset(layout, null, 42)).toBe(7);
    expect(startingChangeset(layout, null, null)).toBe(7);
  });
});
