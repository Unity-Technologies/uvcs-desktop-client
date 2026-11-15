import { describe, expect, it } from 'vitest';
import { lineHover, type FrameScheduler } from './lineHover';

/** Frames run only when the test says a frame passed. */
function testFrames() {
  const waiting = new Map<number, () => void>();
  let next = 1;
  const frames: FrameScheduler = {
    request: (run) => {
      waiting.set(next, run);
      return next++;
    },
    cancel: (id) => void waiting.delete(id),
  };
  const passFrame = (): void => {
    const runs = [...waiting.values()];
    waiting.clear();
    for (const run of runs) run();
  };
  return { frames, passFrame, waiting };
}

describe('lineHover', () => {
  it('keeps the button as the pointer goes from line to line: left, then the next entered in the same frame', () => {
    const shown: (number | null)[] = [];
    const { frames, passFrame } = testFrames();
    const hover = lineHover<number>((line) => shown.push(line), frames);

    hover.enter(3);
    hover.leave();
    hover.enter(4);
    passFrame();

    expect(shown).toEqual([3, 4]);
  });

  it('clears it a frame after the pointer leaves the lines', () => {
    const shown: (number | null)[] = [];
    const { frames, passFrame } = testFrames();
    const hover = lineHover<number>((line) => shown.push(line), frames);

    hover.enter(3);
    hover.leave();
    expect(shown).toEqual([3]);
    passFrame();

    expect(shown).toEqual([3, null]);
  });

  it('keeps the line while the pointer is on the button, whichever the diff or the button says first', () => {
    const shown: (number | null)[] = [];
    const { frames, passFrame } = testFrames();
    const hover = lineHover<number>((line) => shown.push(line), frames);

    hover.enter(3);
    hover.hold();
    hover.leave();
    passFrame();

    expect(shown).toEqual([3]);
  });

  it('clears it a frame after the pointer leaves the button for somewhere off the lines', () => {
    const shown: (number | null)[] = [];
    const { frames, passFrame } = testFrames();
    const hover = lineHover<number>((line) => shown.push(line), frames);

    hover.enter(3);
    hover.hold();
    hover.leave();
    hover.release();
    passFrame();

    expect(shown).toEqual([3, null]);
  });

  it('shows the line the pointer goes to from the button', () => {
    const shown: (number | null)[] = [];
    const { frames, passFrame } = testFrames();
    const hover = lineHover<number>((line) => shown.push(line), frames);

    hover.enter(3);
    hover.hold();
    hover.leave();
    hover.release();
    hover.enter(4);
    passFrame();

    expect(shown).toEqual([3, 4]);
  });

  it('calls off a clear still waiting once disposed', () => {
    const shown: (number | null)[] = [];
    const { frames, waiting } = testFrames();
    const hover = lineHover<number>((line) => shown.push(line), frames);

    hover.enter(3);
    hover.leave();
    hover.dispose();

    expect(waiting.size).toBe(0);
  });
});
