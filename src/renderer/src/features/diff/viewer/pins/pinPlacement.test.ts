import { describe, expect, it } from 'vitest';
import { boundsOf, cardPlacement, cardStyleOf, pinBounds, pinCardPlacement, PIN_CARD_WIDTH, PIN_SIZE, roomBesideCard, stageCardPlacement } from './pinPlacement';

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

describe('roomBesideCard', () => {
  it("is the pane's left, short of the card and the controls, where a card fits beside a point", () => {
    expect(roomBesideCard({ width: 1200, height: 700 })).toEqual({ x: 0, y: 0, width: 738, height: 700 });
  });

  it("is the pane's top, short of a card below a point, where none fits beside it", () => {
    expect(roomBesideCard({ width: 600, height: 700 })).toEqual({ x: 0, y: 0, width: 548, height: 480 });
  });

  it('is the whole pane where a card fits neither beside nor below a point', () => {
    expect(roomBesideCard({ width: 400, height: 300 })).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it('leaves the card room beside a point in its middle: the card goes there, not over it', () => {
    for (const pane of [{ width: 1200, height: 700 }, { width: 600, height: 700 }]) {
      const room = roomBesideCard(pane);
      const point = { x: room.x + room.width / 2, y: room.y + room.height / 2, width: 0, height: 0 };
      const placement = pinCardPlacement(point, pane);
      const card = { x: placement.left, y: 'top' in placement ? placement.top : 0, width: placement.width, height: 1 };
      expect(card.x >= point.x + PIN_SIZE || card.y > point.y).toBe(true);
    }
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
