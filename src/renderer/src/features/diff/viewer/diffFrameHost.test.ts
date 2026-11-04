import { describe, expect, it } from 'vitest';
import { headerArrows, headerKeepsFor, isSelectedFile, type HeaderState } from './diffFrameHost';
import type { StepNavigation } from './useStepNavigation';

const navigation = { noun: 'change' } as StepNavigation;
const published = (key: string) => ({ navigation, stepsOwn: true, key });
/** The selected file is b.cs, read and drawn. */
const read: HeaderState = { published: published('b.cs'), requestedKey: 'b.cs', error: false, hasData: true, isPlaceholderData: false };

describe('headerArrows', () => {
  it("steps with the diff shown once it is the selected file's: its changes, its label, its keys", () => {
    expect(headerArrows(read)).toEqual({ body: published('b.cs'), headerKeys: false, queues: false, replaysKept: false });
  });

  it("never trusts the previous file's diff while the next is read, still on screen: no place shown, presses kept", () => {
    expect(headerArrows({ ...read, published: published('a.cs'), isPlaceholderData: true })).toEqual({ body: null, headerKeys: true, queues: true, replaysKept: false });
  });

  it("keeps them the same once the next file is read and its diff mounted, the previous one's navigation still published", () => {
    expect(headerArrows({ ...read, published: published('a.cs') })).toEqual({ body: null, headerKeys: true, queues: true, replaysKept: false });
  });

  it('keeps them while the first diff is read, or read but not drawn yet (its viewer loading on first use)', () => {
    expect(headerArrows({ ...read, published: null, hasData: false })).toEqual({ body: null, headerKeys: true, queues: true, replaysKept: false });
    expect(headerArrows({ ...read, published: null })).toEqual({ body: null, headerKeys: true, queues: true, replaysKept: false });
  });

  it("goes from file to file at once where the file couldn't be read, replaying the presses kept for it as such steps", () => {
    expect(headerArrows({ ...read, published: null, error: true, hasData: false })).toEqual({ body: null, headerKeys: true, queues: false, replaysKept: true });
  });
});

describe('headerKeepsFor', () => {
  it('keeps a press made while the diff is read or drawn for the file a step is on its way to', () => {
    expect(headerKeepsFor({ steppingTo: 'c.cs', requestedPath: 'b.cs' })).toBe('c.cs');
  });

  it('else for the file asked for', () => {
    expect(headerKeepsFor({ steppingTo: null, requestedPath: 'b.cs' })).toBe('b.cs');
  });
});

describe('isSelectedFile', () => {
  it("tells the selected file's diff from a previous one kept on screen by the versions it shows", () => {
    expect(isSelectedFile('b.cs', 'b.cs')).toBe(true);
    expect(isSelectedFile('a.cs', 'b.cs')).toBe(false);
  });
});
