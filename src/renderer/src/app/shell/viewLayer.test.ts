import { describe, expect, it } from 'vitest';
import type { Page } from '../navigation/pages';
import { viewLayerShown } from './viewLayer';

describe('viewLayerShown', () => {
  it('shows the view while no page is over it, and keeps it mounted but hidden under one: its keys off meanwhile', () => {
    const review: Page = { kind: 'codeReview', reviewId: 41 };
    expect(viewLayerShown(undefined)).toBe(true);
    expect(viewLayerShown(review)).toBe(false);
  });
});
