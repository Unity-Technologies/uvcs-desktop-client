import { describe, expect, it } from 'vitest';
import { headerArrows, queuedStep, type HeaderArrows } from './diffFrameHost';
import type { StepNavigation } from './useStepNavigation';

const navigation = (noun: string, more: Partial<StepNavigation> = {}): StepNavigation => ({
  noun,
  shortcuts: { next: 'nextChange', previous: 'previousChange' },
  count: 0,
  current: null,
  opened: false,
  goesTo: () => null,
  go: () => undefined,
  onViewScroll: () => undefined,
  ...more,
});

describe('headerArrows', () => {
  it("steps with the diff shown once it is the selected file's: its changes, its label, its keys", () => {
    const loaded = { navigation: navigation('b.cs'), stepsOwn: true };
    expect(headerArrows({ published: loaded, bodyCurrent: true, loading: false })).toEqual({ body: loaded, headerKeys: false, queues: false });
  });

  it("never shows another file's place while the next file loads, its previous diff still on screen: presses wait for it", () => {
    const previous = { navigation: navigation('a.cs', { current: 2, count: 3 }), stepsOwn: true };
    expect(headerArrows({ published: previous, bodyCurrent: false, loading: true })).toEqual({ body: null, headerKeys: true, queues: true });
  });

  it('waits the same while the first diff loads, nothing on screen yet', () => {
    expect(headerArrows({ published: null, bodyCurrent: false, loading: true })).toEqual({ body: null, headerKeys: true, queues: true });
  });

  it('waits while the selected file is read but its diff not drawn yet (the viewer loading on first use)', () => {
    expect(headerArrows({ published: null, bodyCurrent: true, loading: false })).toEqual({ body: null, headerKeys: true, queues: true });
  });

  it("goes from file to file at once where the file couldn't be read", () => {
    expect(headerArrows({ published: null, bodyCurrent: false, loading: false })).toEqual({ body: null, headerKeys: true, queues: false });
  });
});

describe('queuedStep', () => {
  const onBody = (body: StepNavigation, stepsOwn = true): HeaderArrows => ({ body: { navigation: body, stepsOwn }, headerKeys: false, queues: false });
  const waiting: HeaderArrows = { body: null, headerKeys: true, queues: true };

  it('keeps the presses while the file loads', () => {
    expect(queuedStep([1], waiting)).toEqual({ kind: 'wait' });
  });

  it('waits for the loaded diff to arrive at its first change before applying them: ↓ during the load lands on the 2nd', () => {
    expect(queuedStep([1], onBody(navigation('b.cs', { count: 3, opened: false })))).toEqual({ kind: 'wait' });
    expect(queuedStep([1], onBody(navigation('b.cs', { count: 3, current: 0, opened: true })))).toEqual({ kind: 'apply', direction: 1 });
  });

  it('applies them at once to a diff with no changes of its own (an image), which steps on to the next file', () => {
    expect(queuedStep([-1], onBody(navigation('logo.png'), false))).toEqual({ kind: 'apply', direction: -1 });
  });

  it("drops them where the file couldn't be read: they were meant for a diff that never came", () => {
    expect(queuedStep([1], { body: null, headerKeys: true, queues: false })).toEqual({ kind: 'drop' });
  });

  it('has nothing to do with no press waiting', () => {
    expect(queuedStep([], onBody(navigation('b.cs', { opened: true })))).toEqual({ kind: 'none' });
  });
});
