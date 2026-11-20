import { describe, expect, it } from 'vitest';
import { suggestionViewToggle } from './suggestionViewToggle';

describe('suggestionViewToggle', () => {
  it('offers the diff while stacked, and the stacked lines while a diff, pressed then', () => {
    expect(suggestionViewToggle('stacked')).toEqual({ label: 'Show as a diff', pressed: false, next: 'diff' });
    expect(suggestionViewToggle('diff')).toEqual({ label: 'Show the lines stacked', pressed: true, next: 'stacked' });
  });
});
