import { describe, expect, it } from 'vitest';
import { branchExplorerFinds } from './branchExplorerFinds';

describe('branchExplorerFinds', () => {
  it('reads hidden branches with every field the graph draws', () => {
    const finds = branchExplorerFinds({ includeHidden: false });
    expect(finds.hiddenBranches[2]).toBe("where hidden = 'true'");
    expect(finds.hiddenBranches[3]).toBe(finds.branches[2]);
  });

  it("asks for the changesets of hidden branches only when they show: `cm find changeset` leaves them out otherwise", () => {
    // /main/TASK1008897 on a large repository was hidden, and its cs:278638, merged into /main's cs:278758, never loaded.
    const shown = branchExplorerFinds({ sinceDate: '2026-07-01', includeHidden: true }).changesets[2]!;
    expect(shown).toMatch(/^where ignorehidden = 'true' and date >= '2026-07-01T00:00:00/);
    expect(branchExplorerFinds({ sinceDate: '2026-07-01', includeHidden: false }).changesets[2]).toMatch(/^where date >= /);
    expect(branchExplorerFinds({ includeHidden: true }).changesets[2]).toBe("where ignorehidden = 'true'");
  });

  it('bounds merges and labels by the same dates, hidden or not', () => {
    const finds = branchExplorerFinds({ sinceDate: '2026-07-01', includeHidden: true });
    expect(finds.merges[2]).toMatch(/^where date >= '2026-07-01T/);
    expect(finds.labels[2]).toBe(finds.merges[2]);
  });
});
