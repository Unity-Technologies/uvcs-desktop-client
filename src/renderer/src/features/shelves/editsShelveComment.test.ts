import { describe, expect, it } from 'vitest';
import { AUTOMATIC_SHELVE_COMMENT } from '@shared/domain/shelve';
import { editsShelveComment } from './editsShelveComment';

const AUTOMATIC = `${AUTOMATIC_SHELVE_COMMENT} (from br:3)`;

describe('editsShelveComment', () => {
  it("edits the user's own shelve, whatever its comment says", () => {
    expect(editsShelveComment({ comment: 'Spike the new HUD' })).toBe(true);
    expect(editsShelveComment({ comment: '' })).toBe(true);
    expect(editsShelveComment({ comment: `Not an ${AUTOMATIC_SHELVE_COMMENT}` })).toBe(true);
  });

  it("leaves someone else's to them", () => {
    expect(editsShelveComment({ comment: 'Spike' }, { mine: false })).toBe(false);
  });

  it('never edits changes a switch or an update left, which their comment marks as such for every client', () => {
    expect(editsShelveComment({ comment: 'Spike' }, { left: true })).toBe(false);
    expect(editsShelveComment({ comment: AUTOMATIC })).toBe(false);
  });
});
