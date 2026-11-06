import { describe, expect, it } from 'vitest';
import { avatarStackLayout, RING_REACH } from '../../ui/avatarStackLayout';
import { REVIEWER_AVATAR_SIZE, REVIEWERS_COLUMN_WIDTH, SHOWN_REVIEWERS } from './reviewers';

/** A table cell's padding on each side: `DataTable.module.css`'s `.cell`, `var(--space-3)`. */
const CELL_PADDING = 12;

describe('the Reviewers column', () => {
  it('holds the reviewers spread, "+N" and rings included, so the cell never cuts them', () => {
    const { spreadWidth } = avatarStackLayout(SHOWN_REVIEWERS + 1, REVIEWER_AVATAR_SIZE);
    expect(spreadWidth + 2 * RING_REACH).toBeLessThanOrEqual(REVIEWERS_COLUMN_WIDTH - 2 * CELL_PADDING);
  });
});
