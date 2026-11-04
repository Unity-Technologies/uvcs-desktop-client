import { describe, expect, it } from 'vitest';
import { headerArrows, type HeaderState } from './diffFrameHost';
import type { StepNavigation } from './useStepNavigation';

const navigation = { noun: 'change' } as StepNavigation;
const published = (key: string) => ({ navigation, stepsOwn: true, key });
/** The selected file is b.cs, read and drawn. */
const read: HeaderState = { published: published('b.cs'), requestedKey: 'b.cs', error: false, hasData: true, isPlaceholderData: false };

describe('headerArrows', () => {
  it("steps with the diff shown once it is the selected file's: its changes, its label, its keys", () => {
    expect(headerArrows(read)).toEqual({ body: published('b.cs'), headerKeys: false, queues: false });
  });

  it("never trusts the previous file's diff while the next is read, still on screen: no place shown, presses kept", () => {
    expect(headerArrows({ ...read, published: published('a.cs'), isPlaceholderData: true })).toEqual({ body: null, headerKeys: true, queues: true });
  });

  it("keeps them the same once the next file is read and its diff mounted, the previous one's navigation still published", () => {
    expect(headerArrows({ ...read, published: published('a.cs') })).toEqual({ body: null, headerKeys: true, queues: true });
  });

  it('keeps them while the first diff is read, or read but not drawn yet (its viewer loading on first use)', () => {
    expect(headerArrows({ ...read, published: null, hasData: false })).toEqual({ body: null, headerKeys: true, queues: true });
    expect(headerArrows({ ...read, published: null })).toEqual({ body: null, headerKeys: true, queues: true });
  });

  it("goes from file to file at once where the file couldn't be read", () => {
    expect(headerArrows({ ...read, published: null, error: true, hasData: false })).toEqual({ body: null, headerKeys: true, queues: false });
  });
});
