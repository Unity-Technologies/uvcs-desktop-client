/** The command that shows or hides the Timeline: its words, and what it does from where it runs. */
export interface TimelineToggle {
  /** The palette's words, saying what it will do. */
  label: string;
  /** Whether the Timeline shows after it ran. */
  show: boolean;
  /** Whether it opens the Branch Explorer first: run from another view, it shows the Timeline there. */
  opensBranchExplorer: boolean;
}

/**
 * In the Branch Explorer it shows or hides the Timeline; from anywhere else in the place (the app menu, its shortcut,
 * the palette) it opens the Branch Explorer with the Timeline shown, never hiding something the user can't see.
 */
export function timelineToggle(shown: boolean, inBranchExplorer: boolean): TimelineToggle {
  if (!inBranchExplorer) return { label: 'Show the Branch Explorer timeline', show: true, opensBranchExplorer: true };
  return { label: shown ? 'Hide timeline' : 'Show timeline', show: !shown, opensBranchExplorer: false };
}
