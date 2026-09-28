import { describe, expect, it } from 'vitest';
import {
  describePick,
  EVERYONE,
  MAX_PICKED_PEOPLE,
  matchesPeople,
  MINE,
  offeredPeople,
  onlyPerson,
  othersLabel,
  pickedNames,
  pickedOwners,
  rememberedPick,
  togglePerson,
} from './peopleFilter';

const ME = 'daniel.penalba@unity3d.com';
const ANA = 'ana.diaz@unity3d.com';
const BOB = 'bob@unity3d.com';

describe('pickedOwners', () => {
  it('asks for nobody in particular for everyone', () => {
    expect(pickedOwners(EVERYONE)).toBeUndefined();
  });

  it("names the user as cm's me, and sorts the others so equal picks share a query", () => {
    expect(pickedOwners(MINE)).toEqual(['me']);
    expect(pickedOwners({ mine: true, others: [BOB, ANA] })).toEqual(['me', ANA, BOB]);
    expect(pickedOwners({ mine: false, others: [ANA, BOB] })).toEqual(pickedOwners({ mine: false, others: [BOB, ANA] }));
  });
});

describe('matchesPeople', () => {
  it('keeps every row for everyone', () => {
    expect(matchesPeople(EVERYONE, ME, BOB)).toBe(true);
  });

  it("keeps the user's rows and the picked people's", () => {
    const pick = { mine: true, others: [ANA] };
    expect(matchesPeople(pick, ME, ME)).toBe(true);
    expect(matchesPeople(pick, ME, ANA)).toBe(true);
    expect(matchesPeople(pick, ME, BOB)).toBe(false);
    expect(matchesPeople({ mine: false, others: [ANA] }, ME, ME)).toBe(false);
  });

  it("leaves the user's rows to the server while it's unknown who the user is", () => {
    expect(matchesPeople(MINE, undefined, BOB)).toBe(true);
  });
});

describe('pickedNames', () => {
  it('names the people a pick keeps, the user by name', () => {
    expect(pickedNames(EVERYONE, ME)).toBeNull();
    expect(pickedNames({ mine: true, others: [ANA] }, ME)).toEqual(new Set([ANA, ME]));
    expect(pickedNames(MINE, undefined)).toEqual(new Set());
  });
});

describe('togglePerson', () => {
  it('adds and removes people, in the order picked', () => {
    const picked = togglePerson(togglePerson(EVERYONE, BOB, ME), ANA, ME);
    expect(picked.others).toEqual([BOB, ANA]);
    expect(togglePerson(picked, BOB, ME).others).toEqual([ANA]);
  });

  it("turns the user's own name into Mine", () => {
    expect(togglePerson(EVERYONE, ME, ME)).toEqual(MINE);
    expect(togglePerson(MINE, ME, ME)).toEqual(EVERYONE);
  });

  it(`stops at ${MAX_PICKED_PEOPLE} people`, () => {
    const full = { mine: false, others: Array.from({ length: MAX_PICKED_PEOPLE }, (_, index) => `user${index}`) };
    expect(togglePerson(full, 'one.more', ME)).toBe(full);
  });
});

describe('onlyPerson', () => {
  it('picks one person, or Mine for the user', () => {
    expect(onlyPerson(ANA, ME)).toEqual({ mine: false, others: [ANA] });
    expect(onlyPerson(ME, ME)).toEqual(MINE);
  });
});

describe('labels', () => {
  it('read the first person picked and how many more', () => {
    expect(othersLabel([])).toBe('');
    expect(othersLabel([ANA])).toBe('Ana Diaz');
    expect(othersLabel([ANA, BOB, 'carl'])).toBe('Ana Diaz +2');
  });

  it('describe the whole pick', () => {
    expect(describePick(EVERYONE)).toBe('Everyone');
    expect(describePick(MINE)).toBe('Mine');
    expect(describePick({ mine: true, others: [ANA] })).toBe('Mine and Ana Diaz');
    expect(describePick({ mine: false, others: [ANA, BOB] })).toBe('Ana Diaz +1');
  });
});

describe('offeredPeople', () => {
  it('offers the people picked first, then the rest by name, without the user or repeats', () => {
    expect(offeredPeople([BOB, ME, 'zoe@unity3d.com', ANA, BOB, ''], { mine: true, others: ['zoe@unity3d.com'] }, ME)).toEqual(['zoe@unity3d.com', ANA, BOB]);
  });

  it('keeps people picked that the rows no longer show', () => {
    expect(offeredPeople([ANA], { mine: false, others: [BOB] }, ME)).toEqual([BOB, ANA]);
  });
});

describe('rememberedPick', () => {
  it('keeps only whether the pick was Mine', () => {
    expect(rememberedPick({ mine: true, others: [ANA] })).toEqual(MINE);
    expect(rememberedPick({ mine: false, others: [ANA] })).toEqual(EVERYONE);
  });
});
