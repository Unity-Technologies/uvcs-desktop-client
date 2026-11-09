import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarColorOf } from '../../../lib/avatarColors';
import { hueToColor, hueToInk } from '../model/branchHue';
import { NO_RULE_COLORS, type RuleColors } from '../model/ruleColors';
import {
  avatarFill,
  branchColor,
  branchInk,
  changesetColor,
  headerColor,
  headerNameInk,
  hueToTint,
  labelInks,
  withBranchColors,
  withRuleColors,
  type GraphPalette,
} from './graphPalette';

/** The avatar fills as a theme resolves its `--avatar-*` tokens: here each one's own name, to tell them apart. */
const avatars = Object.fromEntries(AVATAR_COLORS.map((token) => [token, `resolved ${token}`])) as GraphPalette['avatars'];

describe('avatarFill', () => {
  it('paints an author’s avatar in the fill every other avatar of theirs has (`avatarColorOf`), as the theme resolves it', () => {
    for (const owner of ['ana@example.com', 'bob', 'dev17@example.com']) {
      expect(avatarFill({ avatars } as GraphPalette, owner)).toBe(`resolved ${avatarColorOf(owner)}`);
    }
  });
});

describe('withBranchColors', () => {
  const palette = { isDark: false, accent: 'accent', accentText: 'accent text', branchHues: true, ruleColors: NO_RULE_COLORS } as GraphPalette;

  it('paints every branch in the accent when branch colors are off, /main included', () => {
    const plain = withBranchColors(palette, false);
    for (const name of ['/main', '/main/task-12', '/main/feature/ui']) {
      expect(branchColor(plain, name)).toBe('accent');
      expect(branchInk(plain, name)).toBe('accent text');
    }
  });

  it('keeps each branch’s own hue when they are on', () => {
    expect(withBranchColors(palette, true)).toBe(palette);
    expect(branchColor(palette, '/main/task-12')).not.toBe('accent');
  });

  it('hands back the same palette each frame, so the colors it remembers are kept', () => {
    expect(withBranchColors(palette, false)).toBe(withBranchColors(palette, false));
  });
});

describe('withRuleColors', () => {
  const themed = {
    isDark: false,
    accent: 'accent',
    accentText: 'accent text',
    labelBackground: 'label bg',
    labelText: 'label text',
    branchHues: true,
    ruleColors: NO_RULE_COLORS,
  } as GraphPalette;
  const colors: RuleColors = {
    branches: new Map([['/main/task', 120], ['/main', 300]]),
    changesets: new Map([[7, 200]]),
    labels: new Map([['v2', 40]]),
  };
  const ruled = withRuleColors(themed, colors);

  it('hands back the same palette without rule colors, and the same one each frame with them', () => {
    expect(withRuleColors(themed, NO_RULE_COLORS)).toBe(themed);
    expect(withRuleColors(themed, colors)).toBe(ruled);
  });

  it("paints a branch a rule colors in the rule's hue, even with branch colors off", () => {
    expect(branchColor(ruled, '/main/task')).toBe(hueToColor(120, false));
    expect(branchColor(withRuleColors(withBranchColors(themed, false), colors), '/main/task')).toBe(hueToColor(120, false));
    expect(branchColor(withRuleColors(withBranchColors(themed, false), colors), '/main/other')).toBe('accent');
  });

  it("paints the workspace branch's header in the accent, unless a rule colors it", () => {
    expect(headerColor(ruled, '/main/other', true)).toBe('accent');
    expect(headerNameInk(ruled, '/main/other', true)).toBe('accent text');
    expect(headerColor(ruled, '/main', true)).toBe(hueToColor(300, false));
    expect(headerNameInk(ruled, '/main', true)).toBe(hueToInk(300, false));
  });

  it("paints a changeset a rule colors in the rule's hue, the others in their branch's", () => {
    expect(changesetColor(ruled, 7, '/main/other')).toBe(hueToColor(200, false));
    expect(changesetColor(ruled, 8, '/main/task')).toBe(hueToColor(120, false));
  });

  it("tints a label chip by the first of its labels a rule colors, the others in the theme's colors", () => {
    expect(labelInks(ruled, ['v1', 'v2'])).toEqual({ background: hueToTint(40, false), text: hueToInk(40, false) });
    expect(labelInks(ruled, ['v1'])).toEqual({ background: 'label bg', text: 'label text' });
  });
});
