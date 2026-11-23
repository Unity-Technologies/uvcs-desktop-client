import { describe, expect, it } from 'vitest';
import { boundsOf, cardPlacement, cardStyleOf, focusLeavesHiddenCard, pinBounds, pinCardPlacement, keptCardPlacement, PIN_CARD_WIDTH, stageCardPlacement, viewKeyOf } from './pinPlacement';

describe('cardPlacement', () => {
  const VIEWPORT = { width: 1000, height: 600 };

  it('goes right of the spot, level with it', () => {
    expect(cardPlacement({ x: 100, y: 50, width: 20, height: 10 }, VIEWPORT, 360)).toEqual({ left: 132, top: 50, width: 360, maxHeight: 542 });
  });

  it('goes left when the right has no room', () => {
    expect(cardPlacement({ x: 800, y: 50, width: 0, height: 0 }, VIEWPORT, 360)).toMatchObject({ left: 428, top: 50 });
  });

  it('lifts a card beside a spot near the bottom, so more than its header shows', () => {
    expect(cardPlacement({ x: 100, y: 590, width: 0, height: 0 }, VIEWPORT, 360)).toMatchObject({ top: 392, maxHeight: 200 });
  });

  it('goes below the spot when neither side has room, not over what it is about', () => {
    expect(cardPlacement({ x: 150, y: 40, width: 100, height: 60 }, { width: 400, height: 600 }, 360)).toEqual({ left: 32, top: 112, width: 360, maxHeight: 480 });
  });

  it('goes above it when below has less room', () => {
    expect(cardPlacement({ x: 20, y: 400, width: 300, height: 150 }, { width: 400, height: 600 }, 360)).toEqual({ left: 20, bottom: 212, width: 360, maxHeight: 380 });
  });

  it('goes over it only when no side has room', () => {
    expect(cardPlacement({ x: 20, y: 100, width: 300, height: 150 }, { width: 400, height: 300 }, 360)).toMatchObject({ left: 20, top: 92 });
  });

  it('narrows to the viewport when it is narrower than the card, within its margins', () => {
    expect(cardPlacement({ x: 100, y: 40, width: 0, height: 0 }, { width: 300, height: 600 }, 360)).toMatchObject({ left: 8, width: 284 });
  });
});

describe('pinBounds', () => {
  it("covers a point's bubble above it, and an area with its bubble", () => {
    expect(pinBounds({ x: 100, y: 100, width: 0, height: 0 })).toEqual({ x: 100, y: 70, width: 30, height: 30 });
    expect(pinBounds({ x: 100, y: 100, width: 200, height: 50 })).toEqual({ x: 100, y: 70, width: 200, height: 80 });
  });
});

describe('pinCardPlacement', () => {
  it("leaves the stage's floating controls at its right edge clear", () => {
    // 1000 wide, 52 of it the controls': a card right of a pin at 600 would reach 984, under them; it goes left.
    expect(pinCardPlacement({ x: 600, y: 100, width: 0, height: 0 }, { width: 1000, height: 600 })).toMatchObject({ left: 228 });
  });
});

describe('pinCardPlacement on a narrow stage', () => {
  it("narrows a model's card to a stage narrower than it, clear of the controls, in a narrow window", () => {
    // A 340 px stage beside the Comments panel: 340 - 52 for the controls - 8 each side leaves 272.
    const placement = pinCardPlacement({ x: 120, y: 200, width: 0, height: 0 }, { width: 340, height: 450 });
    expect(placement).toMatchObject({ left: 8, width: 272 });
  });
});

describe('stageCardPlacement', () => {
  const STAGE = { width: 600, height: 600 };

  it("places a card over the whole stage from a pin in one of Split's panes, clear of the controls", () => {
    // The right pane starts at 300: its pin at 50 is at 350 on the stage; a card right of it would reach the controls.
    const placement = stageCardPlacement({ x: 50, y: 100, width: 0, height: 0 }, { x: 300, y: 0, width: 300, height: 600 }, STAGE);
    expect(placement).toMatchObject({ width: PIN_CARD_WIDTH });
    expect(placement!.left + placement!.width).toBeLessThanOrEqual(STAGE.width - 52);
    expect(placement!.left).toBeGreaterThanOrEqual(0);
  });

  it('has none while the spot is out of its pane, panned or zoomed away: a card there would point at nothing', () => {
    const pane = { x: 300, y: 0, width: 300, height: 600 };
    expect(stageCardPlacement({ x: -5, y: 100, width: 0, height: 0 }, pane, STAGE)).toBeNull();
    expect(stageCardPlacement({ x: 100, y: 601, width: 0, height: 0 }, pane, STAGE)).toBeNull();
    expect(stageCardPlacement({ x: 301, y: 100, width: 0, height: 0 }, pane, STAGE)).toBeNull();
  });

  it('has one while any of an area shows, and for a point on the pane\'s edge', () => {
    const pane = { x: 300, y: 0, width: 300, height: 600 };
    expect(stageCardPlacement({ x: -100, y: 100, width: 120, height: 50 }, pane, STAGE)).not.toBeNull();
    expect(stageCardPlacement({ x: 0, y: 600, width: 0, height: 0 }, pane, STAGE)).not.toBeNull();
  });

  it('narrows a card on a stage narrower than it, clear of the controls', () => {
    const placement = stageCardPlacement({ x: 50, y: 100, width: 0, height: 0 }, { x: 150, y: 0, width: 150, height: 600 }, { width: 300, height: 600 });
    expect(placement).toMatchObject({ left: 8, width: 232 });
  });
});

describe('pinCardPlacement beside what the pin is about', () => {
  it("goes below a model's part, not just below its bubble, when neither side of the part has room", () => {
    const placement = pinCardPlacement({ x: 500, y: 100, width: 0, height: 0 }, { width: 1000, height: 800 }, { x: 300, y: 80, width: 400, height: 150 });
    expect(placement).toMatchObject({ top: 242 });
  });
});

describe('keptCardPlacement', () => {
  // A card right of a pin at (100, 100): its box from 142 to 502 across, 70 to 270 down.
  const PIN = { x: 100, y: 100, width: 0, height: 0 };
  const HELD = { placement: pinCardPlacement(PIN, { width: 1000, height: 600 }), box: { x: 142, y: 70, width: 360, height: 200 } };
  const fresh = (pin: { x: number; y: number; width: number; height: number }) => pinCardPlacement(pin, { width: 1000, height: 600 });

  it('stays where it was while a take sways the pin a little under a still camera: no wobble', () => {
    const swayed = { x: 96, y: 112, width: 0, height: 0 };
    expect(keptCardPlacement(HELD, fresh(swayed), pinBounds(swayed), false)).toBe(HELD.placement);
  });

  it('follows the pin once the take would bring the pin under it', () => {
    const under = { x: 200, y: 150, width: 0, height: 0 };
    expect(keptCardPlacement(HELD, fresh(under), pinBounds(under), false)).toEqual(fresh(under));
  });

  it('follows the pin once the take carries it far from the card, where the card would point at nothing', () => {
    const far = { x: 100, y: 500, width: 0, height: 0 };
    expect(keptCardPlacement(HELD, fresh(far), pinBounds(far), false)).toEqual(fresh(far));
  });

  it('follows the pin whenever the view moves: a turn, a zoom, a resize', () => {
    const swayed = { x: 96, y: 112, width: 0, height: 0 };
    expect(keptCardPlacement(HELD, fresh(swayed), pinBounds(swayed), true)).toEqual(fresh(swayed));
  });

  it('is placed afresh when there is none held yet', () => {
    expect(keptCardPlacement(null, fresh(PIN), pinBounds(PIN), false)).toEqual(fresh(PIN));
  });
});

describe('viewKeyOf', () => {
  const VIEW = { target: [0, 1, 0] as const, yaw: 0.5, pitch: 0.3, distance: 4 };
  const PANES = [{ x: 0, y: 0, width: 400, height: 300 }, null];

  it('is the same for the same view and panes: a take playing under it moves neither', () => {
    expect(viewKeyOf({ ...VIEW, target: [0, 1, 0] }, [{ ...PANES[0]! }, null])).toBe(viewKeyOf(VIEW, PANES));
  });

  it('changes with any part of the view: a turn, a pan, a zoom, even one that leaves the camera where it was', () => {
    const key = viewKeyOf(VIEW, PANES);
    expect(viewKeyOf({ ...VIEW, yaw: 0.6 }, PANES)).not.toBe(key);
    expect(viewKeyOf({ ...VIEW, pitch: 0.4 }, PANES)).not.toBe(key);
    expect(viewKeyOf({ ...VIEW, target: [0, 1.1, 0] }, PANES)).not.toBe(key);
    expect(viewKeyOf({ ...VIEW, distance: 5 }, PANES)).not.toBe(key);
  });

  it('changes with the panes: a resize, a mode, Split shown or not', () => {
    const key = viewKeyOf(VIEW, PANES);
    expect(viewKeyOf(VIEW, [{ x: 0, y: 0, width: 500, height: 300 }, null])).not.toBe(key);
    expect(viewKeyOf(VIEW, [PANES[0]!, { x: 400, y: 0, width: 400, height: 300 }])).not.toBe(key);
  });
});

describe('focusLeavesHiddenCard', () => {
  it('hands the focus to the stage when a card holding it hides: a hidden card would swallow the keys typed next', () => {
    expect(focusLeavesHiddenCard(true, true)).toBe(true);
  });

  it('leaves the focus where it is when the card shows, or when it hides without holding it', () => {
    expect(focusLeavesHiddenCard(false, true)).toBe(false);
    expect(focusLeavesHiddenCard(true, false)).toBe(false);
  });
});

describe('cardStyleOf', () => {
  it('sets the edge the card hangs from and clears the other, which an earlier placement may have set', () => {
    expect(cardStyleOf({ left: 8, width: 300, top: 20, maxHeight: 400 })).toEqual({ left: '8px', width: '300px', maxHeight: '400px', top: '20px', bottom: '' });
    expect(cardStyleOf({ left: 8, width: 300, bottom: 20, maxHeight: 400 })).toEqual({ left: '8px', width: '300px', maxHeight: '400px', top: '', bottom: '20px' });
  });
});

describe('boundsOf', () => {
  it('boxes the points, and nothing for none', () => {
    expect(boundsOf([{ x: 10, y: 5 }, { x: 2, y: 9 }])).toEqual({ x: 2, y: 5, width: 8, height: 4 });
    expect(boundsOf([])).toBeNull();
  });
});
