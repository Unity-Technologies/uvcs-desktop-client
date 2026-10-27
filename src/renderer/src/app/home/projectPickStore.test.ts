import { describe, expect, it } from 'vitest';
import { withPick } from './projectPickStore';

describe('withPick', () => {
  it("remembers each organization's project apart", () => {
    expect(withPick({ 'a@unity': 'Racing' }, 'b@unity', 'Art')).toEqual({ 'a@unity': 'Racing', 'b@unity': 'Art' });
    expect(withPick({ 'a@unity': 'Racing' }, 'a@unity', 'Art')).toEqual({ 'a@unity': 'Art' });
  });

  it('forgets the pick of an organization shown with all its projects', () => {
    expect(withPick({ 'a@unity': 'Racing', 'b@unity': 'Art' }, 'a@unity', null)).toEqual({ 'b@unity': 'Art' });
  });
});
