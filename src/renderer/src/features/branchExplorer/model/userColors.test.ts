import { describe, expect, it } from 'vitest';
import { BRANCH_HUES } from './branchHue';
import { changeset, sampleHistory } from './graphFixtures';
import { NO_RULE_COLORS, type RuleColors } from './ruleColors';
import { changesetUserHues, DEFAULT_USER_COLORS, historyAuthors, usersToAdd, withUserColors, withUserHue, withUserRemoved, withUsersAdded, type UserColors } from './userColors';

const [first, second, third] = BRANCH_HUES;

function colorsOf(...users: [string, number][]): UserColors {
  return { on: true, users: users.map(([user, hue]) => ({ user, hue })) };
}

describe('withUsersAdded', () => {
  it('gives each new person the first hue no one has', () => {
    const colors = withUsersAdded(colorsOf(['ana', second!]), ['bo', 'cy']);
    expect(colors.users).toEqual([
      { user: 'ana', hue: second },
      { user: 'bo', hue: first },
      { user: 'cy', hue: third },
    ]);
  });

  it('repeats the hues once every one is taken', () => {
    const everyone = BRANCH_HUES.map((_, index) => `user${index}`);
    const colors = withUsersAdded(DEFAULT_USER_COLORS, [...everyone, 'one more']);
    expect(colors.users.at(-1)).toEqual({ user: 'one more', hue: first });
  });

  it('skips who already has a color, keeping it', () => {
    expect(withUsersAdded(colorsOf(['ana', third!]), ['ana']).users).toEqual([{ user: 'ana', hue: third }]);
  });

  it('keeps the colors off when they were', () => {
    expect(withUsersAdded({ on: false, users: [] }, ['ana']).on).toBe(false);
  });
});

describe('withUserRemoved and withUserHue', () => {
  it('removes one person', () => {
    expect(withUserRemoved(colorsOf(['ana', 1], ['bo', 2]), 'ana')).toEqual(colorsOf(['bo', 2]));
  });

  it("changes one person's hue", () => {
    expect(withUserHue(colorsOf(['ana', 1], ['bo', 2]), 'bo', 9)).toEqual(colorsOf(['ana', 1], ['bo', 9]));
  });
});

describe('historyAuthors', () => {
  it('names each author once', () => {
    const owners = ['jane@example.com', 'bo@example.com', 'jane@example.com'];
    const history = { ...sampleHistory(), changesets: owners.map((owner, id) => ({ ...changeset(id, '/main', id - 1), owner })) };
    expect(historyAuthors(history).sort()).toEqual(['bo@example.com', 'jane@example.com']);
  });
});

describe('usersToAdd', () => {
  it('offers the authors without a color, by name', () => {
    expect(usersToAdd(['zoe@x.com', 'ana@x.com', 'bo@x.com'], colorsOf(['bo@x.com', 1]))).toEqual(['ana@x.com', 'zoe@x.com']);
  });
});

describe('changesetUserHues', () => {
  const history = { ...sampleHistory(), changesets: [changeset(0, '/main', -1), { ...changeset(1, '/main', 0), owner: 'bo@example.com' }] };

  it("colors each person's changesets", () => {
    // sampleHistory's changesets are jane@example.com's.
    expect([...changesetUserHues(history, colorsOf(['jane@example.com', 10], ['bo@example.com', 20]))]).toEqual([
      [0, 10],
      [1, 20],
    ]);
  });

  it('colors nothing while the colors are off, or for people without one', () => {
    expect(changesetUserHues(history, { ...colorsOf(['jane@example.com', 10]), on: false }).size).toBe(0);
    expect(changesetUserHues(history, colorsOf(['someone@example.com', 10])).size).toBe(0);
  });
});

describe('withUserColors', () => {
  it("leaves the rules' colors alone without user colors", () => {
    expect(withUserColors(NO_RULE_COLORS, new Map())).toBe(NO_RULE_COLORS);
  });

  it("lets a format rule's hue win over a user's", () => {
    const rules: RuleColors = { branches: new Map([['/main', 5]]), changesets: new Map([[1, 30]]), labels: new Map() };
    const colors = withUserColors(rules, new Map([[0, 10], [1, 20]]));
    expect([...colors.changesets].sort(([a], [b]) => a - b)).toEqual([[0, 10], [1, 30]]);
    expect(colors.branches).toBe(rules.branches);
  });

  it('colors changesets with no format rules at all', () => {
    expect([...withUserColors(NO_RULE_COLORS, new Map([[0, 10]])).changesets]).toEqual([[0, 10]]);
  });
});
