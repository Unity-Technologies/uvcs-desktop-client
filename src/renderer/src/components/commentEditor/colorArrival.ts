/** How long the text stays unchanged before colors that arrived redraw it (`codeColors`). */
export const TYPING_PAUSE_MS = 200;

/**
 * How long colors that arrived wait before they redraw the code: none after a pause in typing, the rest of the pause
 * while typing. Redrawing a line as a key lands there, the first time a grammar loaded, put a key typed fast at the
 * text's end (seen on screen in a development build; no test reaches the editor's input, so the cause isn't pinned:
 * waiting for a pause is what made it go away).
 */
export function colorArrivalDelay(now: number, typedAt: number): number {
  return Math.max(0, TYPING_PAUSE_MS - (now - typedAt));
}

/** When colors that arrived redraw the code: `arrived` asks, `typed` says the text changed, `stop` drops a wait. */
export interface ColorArrival {
  typed: () => void;
  arrived: () => void;
  stop: () => void;
}

/** Brings colors (`arrive`) once typing pauses (`colorArrivalDelay`): once for all the arrivals asked during a wait. */
export function colorArrival(arrive: () => void, now: () => number): ColorArrival {
  let typedAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arrived = (): void => {
    clearTimeout(timer);
    const wait = colorArrivalDelay(now(), typedAt);
    if (wait > 0) timer = setTimeout(arrived, wait);
    else arrive();
  };
  return {
    typed: () => {
      typedAt = now();
    },
    arrived,
    stop: () => clearTimeout(timer),
  };
}
