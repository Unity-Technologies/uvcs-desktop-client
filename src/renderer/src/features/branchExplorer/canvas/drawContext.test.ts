import { describe, expect, it } from 'vitest';
import { captionAlpha, detailLevel } from './drawContext';
import { DEFAULT_GRAPH_VIEW_OPTIONS } from './graphViewOptions';

describe('captionAlpha', () => {
  it('shows the comments fully when zoomed in and hides them zoomed out', () => {
    expect(captionAlpha(1)).toBe(1);
    expect(captionAlpha(0.8)).toBe(1);
    expect(captionAlpha(0.6)).toBe(0);
  });

  it('fades them in between instead of popping', () => {
    const halfway = captionAlpha(0.725);
    expect(halfway).toBeGreaterThan(0.3);
    expect(halfway).toBeLessThan(0.7);
  });
});

describe('detailLevel', () => {
  it('hides the comments when the user turned them off', () => {
    expect(detailLevel(1, { ...DEFAULT_GRAPH_VIEW_OPTIONS, showComments: false }).captions).toBe(0);
    expect(detailLevel(1, DEFAULT_GRAPH_VIEW_OPTIONS).captions).toBe(1);
  });

  it('hides the avatars when the user turned them off, and when zoomed out', () => {
    expect(detailLevel(1, { ...DEFAULT_GRAPH_VIEW_OPTIONS, showAvatars: false }).avatars).toBe(false);
    expect(detailLevel(0.5, DEFAULT_GRAPH_VIEW_OPTIONS).avatars).toBe(false);
    expect(detailLevel(1, DEFAULT_GRAPH_VIEW_OPTIONS).avatars).toBe(true);
  });

  it('draws everything the user leaves on', () => {
    expect(detailLevel(1, DEFAULT_GRAPH_VIEW_OPTIONS)).toMatchObject({ labels: true, bands: true, branchStarts: true, mergeLinks: true, fullBranchNames: true });
  });

  it('leaves out each part the user turned off, at any zoom', () => {
    const none = { ...DEFAULT_GRAPH_VIEW_OPTIONS, showLabels: false, showBranches: false, showBranchStartLinks: false, showMergeLinks: false, fullBranchNames: false };
    for (const zoom of [0.2, 1, 3]) {
      expect(detailLevel(zoom, none)).toMatchObject({ labels: false, bands: false, branchStarts: false, mergeLinks: false, fullBranchNames: false });
    }
  });
});
