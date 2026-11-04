import { describe, expect, it } from 'vitest';
import { drainsKept, headerArrows, headerPress, isSelectedFile, type HeaderArrows, type HeaderState } from './diffFrameHost';
import type { StepNavigation } from './useStepNavigation';

const navigation = { noun: 'change' } as StepNavigation;
const published = (key: string) => ({ navigation, stepsOwn: true, key });
/** The selected file is b.cs, read and drawn. */
const read: HeaderState = { published: published('b.cs'), requestedKey: 'b.cs', error: false, hasData: true, isPlaceholderData: false };

describe('headerArrows', () => {
  it("steps with the diff shown once it is the selected file's: its changes, its label, its keys", () => {
    expect(headerArrows(read)).toEqual({ body: published('b.cs'), headerKeys: false, queues: false, dropsKept: false });
  });

  it("never trusts the previous file's diff while the next is read, still on screen: no place shown, presses kept", () => {
    expect(headerArrows({ ...read, published: published('a.cs'), isPlaceholderData: true })).toEqual({ body: null, headerKeys: true, queues: true, dropsKept: false });
  });

  it("keeps them the same once the next file is read and its diff mounted, the previous one's navigation still published", () => {
    expect(headerArrows({ ...read, published: published('a.cs') })).toEqual({ body: null, headerKeys: true, queues: true, dropsKept: false });
  });

  it('keeps them while the first diff is read, or read but not drawn yet (its viewer loading on first use)', () => {
    expect(headerArrows({ ...read, published: null, hasData: false })).toEqual({ body: null, headerKeys: true, queues: true, dropsKept: false });
    expect(headerArrows({ ...read, published: null })).toEqual({ body: null, headerKeys: true, queues: true, dropsKept: false });
  });

  it("goes from file to file at once where the file couldn't be read", () => {
    expect(headerArrows({ ...read, published: null, error: true, hasData: false })).toEqual({ body: null, headerKeys: true, queues: false, dropsKept: true });
  });
});

describe('headerPress', () => {
  const onBody: HeaderArrows = { body: published('b.cs'), headerKeys: false, queues: false, dropsKept: false };
  const waiting: HeaderArrows = { body: null, headerKeys: true, queues: true, dropsKept: false };
  const failed: HeaderArrows = { body: null, headerKeys: true, queues: false, dropsKept: true };

  it("hands a press to the selected file's diff once it's the one published", () => {
    expect(headerPress(onBody, { steppingTo: null, requestedPath: 'b.cs' })).toEqual({ kind: 'body' });
  });

  it('keeps it for the file a step is on its way to, else for the file asked for, while its diff is read or drawn', () => {
    expect(headerPress(waiting, { steppingTo: 'c.cs', requestedPath: 'b.cs' })).toEqual({ kind: 'keep', path: 'c.cs' });
    expect(headerPress(waiting, { steppingTo: null, requestedPath: 'b.cs' })).toEqual({ kind: 'keep', path: 'b.cs' });
  });

  it("goes from file to file at once where the file couldn't be read", () => {
    expect(headerPress(failed, { steppingTo: null, requestedPath: 'b.cs' })).toEqual({ kind: 'step' });
  });
});

describe('drainsKept', () => {
  it("lets a diff take its kept presses once it opened at its arrival, while it's the selected file's", () => {
    expect(drainsKept({ opened: true, selected: true })).toBe(true);
  });

  it('not before it opened, nor while it stays on screen for a previous file as the next one is read', () => {
    expect(drainsKept({ opened: false, selected: true })).toBe(false);
    expect(drainsKept({ opened: true, selected: false })).toBe(false);
  });
});

describe('isSelectedFile', () => {
  it("tells the selected file's diff from a previous one kept on screen by the versions it shows", () => {
    expect(isSelectedFile('b.cs', 'b.cs')).toBe(true);
    expect(isSelectedFile('a.cs', 'b.cs')).toBe(false);
  });
});
