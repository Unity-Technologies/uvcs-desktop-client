import { describe, expect, it } from 'vitest';
import { timelineToggle } from './timelineToggle';

describe('timelineToggle', () => {
  it('shows or hides the Timeline in the Branch Explorer', () => {
    expect(timelineToggle(false, true)).toEqual({ label: 'Show timeline', show: true, opensBranchExplorer: false });
    expect(timelineToggle(true, true)).toEqual({ label: 'Hide timeline', show: false, opensBranchExplorer: false });
  });

  it('opens the Branch Explorer with the Timeline from anywhere else, never hiding it unseen', () => {
    for (const shown of [false, true]) expect(timelineToggle(shown, false)).toEqual({ label: 'Show the Branch Explorer timeline', show: true, opensBranchExplorer: true });
  });
});
