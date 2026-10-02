/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_ICON_COLORS } from '@shared/appMark';
import { WINDOW_BACKGROUND } from '@shared/windowChrome';
import { AVATAR_COLORS } from '../lib/avatarColors';
import { HEADER_HOVER_TINT, HEADER_TINT, headerTextOn } from '../features/branchExplorer/canvas/graphPalette';
import { BRANCH_HUES, LINE_TONE } from '../features/branchExplorer/model/branchHue';
import { STABLE_HUES } from '../lib/stableHue';
import { composite, contrastRatio, hslColor, parseColor, themeTokens } from './contrast';

const themes = themeTokens(readFileSync(join(__dirname, 'tokens.css'), 'utf8'));

/** The opaque backgrounds text sits on. */
const SURFACES = ['--bg-app', '--bg-sidebar', '--bg-surface', '--bg-surface-raised', '--bg-subtle', '--bg-input', '--bg-code'];
/** Text down to 11px: WCAG AA asks 4.5:1. */
const TEXT = ['--text-primary', '--text-secondary', '--text-tertiary', '--accent-text', '--label-text', '--status-changed'];
/** Status letters on their own tint and focus rings are graphics: 3:1. */
const BADGES = ['--change-added', '--change-changed', '--change-deleted', '--change-moved', '--change-permissions', '--status-changed', '--permission-allowed', '--permission-denied'];
const BADGE_TINT = 0.16;
/**
 * Where avatars sit: home rows (plain, hovered, focused), the switcher's rows (plain, highlighted), the sidebar's button;
 * people's in lists (plain, hovered, selected) and details panels.
 */
const AVATAR_PLACES: [string, string | null][] = [
  ['--bg-surface', null],
  ['--bg-surface', '--bg-hover'],
  ['--bg-surface', '--bg-selected'],
  ['--bg-app', null],
  ['--bg-app', '--bg-hover'],
  ['--bg-app', '--bg-selected'],
  ['--bg-surface-raised', null],
  ['--bg-surface-raised', '--accent-soft'],
  ['--bg-sidebar', null],
];

function ratio(tokens: Record<string, string>, foreground: string, background: string): number {
  const behind = parseColor(tokens[background]!).rgb;
  return contrastRatio(composite(parseColor(tokens[foreground]!), behind), behind);
}

describe.each(Object.entries(themes))('%s theme', (theme, tokens) => {
  it("is the window's own background (`WINDOW_BACKGROUND`), so no frame shows another color", () => {
    expect(tokens['--bg-app']).toBe(WINDOW_BACKGROUND[theme as keyof typeof WINDOW_BACKGROUND]);
  });

  it.each(TEXT)('%s reads at 4.5:1 on every surface', (text) => {
    for (const surface of SURFACES) expect(ratio(tokens, text, surface), surface).toBeGreaterThanOrEqual(4.5);
  });

  it.each(BADGES)('%s stands out 3:1 from its tinted badge', (color) => {
    const surface = parseColor(tokens['--bg-surface']!).rgb;
    const foreground = parseColor(tokens[color]!);
    const tint = composite({ ...foreground, alpha: BADGE_TINT }, surface);
    expect(contrastRatio(foreground.rgb, tint)).toBeGreaterThanOrEqual(3);
  });

  it.each(['--icon-folder', '--icon-file'])('draws item icons in %s at 3:1 on every surface', (icon) => {
    for (const surface of SURFACES) expect(ratio(tokens, icon, surface), surface).toBeGreaterThanOrEqual(3);
  });

  it.each(['--icon-file', '--icon-source', '--icon-project', '--icon-config', '--icon-media', '--icon-asset'])(
    'draws file glyphs in %s at 3:1 on the page they sit on',
    (glyph) => {
      expect(ratio(tokens, glyph, '--icon-file-fill')).toBeGreaterThanOrEqual(3);
    },
  );

  it('draws focus rings at 3:1 on surfaces and on selected rows', () => {
    for (const surface of SURFACES) expect(ratio(tokens, '--focus-color', surface), surface).toBeGreaterThanOrEqual(3);
    const surface = parseColor(tokens['--bg-surface']!).rgb;
    const selected = composite(parseColor(tokens['--bg-selected-strong']!), surface);
    expect(contrastRatio(parseColor(tokens['--focus-color']!).rgb, selected)).toBeGreaterThanOrEqual(3);
  });

  it.each(['--accent', '--accent-fill-hover', '--danger', '--danger-hover'])('writes button labels at 4.5:1 on a %s fill', (fill) => {
    expect(ratio(tokens, '--accent-contrast', fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('lifts the picked segment above its track, its label reading at 4.5:1', () => {
    const surface = parseColor(tokens['--bg-surface']!).rgb;
    const track = composite(parseColor(tokens['--bg-active']!), surface);
    const checked = parseColor(tokens['--bg-segment-checked']!).rgb;
    const lightness = (rgb: number[]): number => rgb.reduce((sum, channel) => sum + channel, 0);
    expect(lightness(checked)).toBeGreaterThan(lightness(track));
    expect(ratio(tokens, '--text-primary', '--bg-segment-checked')).toBeGreaterThanOrEqual(4.5);
  });

  // White at 4.5:1 caps how light a fill can be, so on the dark theme's surfaces 3:1 is out of reach: 2.5:1, and the hue does the rest.
  it.each(AVATAR_COLORS)('writes the white initial of a %s avatar at 4.5:1, the fill standing 2.5:1 off the rows it sits in', (fill) => {
    // The dark theme only overrides what differs.
    const letter = parseColor({ ...themes.light, ...tokens }['--avatar-letter']!).rgb;
    const color = parseColor(tokens[fill]!).rgb;
    expect(contrastRatio(letter, color)).toBeGreaterThanOrEqual(4.5);
    for (const [surface, state] of AVATAR_PLACES) {
      const opaque = parseColor(tokens[surface]!).rgb;
      const behind = state ? composite(parseColor(tokens[state]!), opaque) : opaque;
      expect(contrastRatio(color, behind), `${surface} ${state ?? ''}`).toBeGreaterThanOrEqual(2.5);
    }
  });

  it('weighs the avatar fills alike, so no repository shouts louder: white reads within 0.2 of the same ratio on each', () => {
    const ratios = AVATAR_COLORS.map((fill) => contrastRatio([255, 255, 255], parseColor(tokens[fill]!).rgb));
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThanOrEqual(0.2);
  });

  // A server monogram's letter is a graphic like the status letters: the name beside it says the same, so 3:1.
  it('draws the letter of a server monogram at 3:1 on its tint, for every hue, surface and row state', () => {
    // The dark theme only overrides what differs.
    const tint = { ...themes.light, ...tokens };
    const rowStates = [null, '--bg-hover', '--bg-selected', '--accent-soft'];
    for (const hue of STABLE_HUES) {
      const letter = hslColor(hue, tint['--tint-text-saturation']!, tint['--tint-text-lightness']!).rgb;
      const fill = hslColor(hue, tint['--tint-bg-saturation']!, tint['--tint-bg-lightness']!, Number(tint['--tint-bg-alpha']));
      for (const surface of SURFACES)
        for (const state of rowStates) {
          const opaque = parseColor(tokens[surface]!).rgb;
          const behind = state ? composite(parseColor(tokens[state]!), opaque) : opaque;
          expect(contrastRatio(letter, composite(fill, behind)), `hue ${hue} on ${surface} ${state ?? ''}`).toBeGreaterThanOrEqual(3);
        }
    }
  });

  it('writes a branch header\'s name at 6:1 and its comment quieter, at 4.5:1, on its tint, hovered or not, for every hue and the accent', () => {
    // The dark theme only overrides what differs.
    const tone = { ...themes.light, ...tokens };
    const surface = parseColor(tokens['--bg-surface-raised']!).rgb;
    const line = LINE_TONE[theme as 'light' | 'dark'];
    const text = {
      name: { saturation: tone['--branch-name-saturation']!, contrast: Number(tone['--branch-name-contrast']) },
      comment: { saturation: tone['--branch-comment-saturation']!, contrast: Number(tone['--branch-comment-contrast']) },
    };
    const fills = [...BRANCH_HUES.map((hue) => [`hue ${hue}`, hslColor(hue, line.saturation, line.lightness).rgb] as const), ['accent', parseColor(tokens['--accent']!).rgb] as const];
    for (const [fill, rgb] of fills) {
      const { name, comment } = headerTextOn(rgb, surface, theme as 'light' | 'dark', text);
      for (const alpha of [HEADER_TINT[theme as 'light' | 'dark'], HEADER_TINT[theme as 'light' | 'dark'] + HEADER_HOVER_TINT]) {
        const tint = composite({ rgb, alpha }, surface);
        const [nameRatio, commentRatio] = [contrastRatio(name, tint), contrastRatio(comment, tint)];
        expect(nameRatio, `${fill}'s name at ${alpha}`).toBeGreaterThanOrEqual(6);
        expect(commentRatio, `${fill}'s comment at ${alpha}`).toBeGreaterThanOrEqual(4.5);
        expect(nameRatio / commentRatio, `${fill}'s name over its comment at ${alpha}`).toBeGreaterThanOrEqual(1.3);
      }
    }
  });

  it.each(['--diff-removed-strong', '--diff-added-strong'])('writes what a move changed (`PathMoveLines`) at 4.5:1 on %s in a tooltip', (mark) => {
    const tooltip = parseColor(tokens['--bg-surface-raised']!).rgb;
    const behind = composite(parseColor(tokens[mark]!), tooltip);
    expect(contrastRatio(composite(parseColor(tokens['--text-primary']!), behind), behind)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps tertiary text quieter than secondary text', () => {
    expect(ratio(tokens, '--text-tertiary', '--bg-surface')).toBeLessThan(ratio(tokens, '--text-secondary', '--bg-surface'));
  });
});

describe('the app icon', () => {
  it('draws the mark in the light theme\'s colors, as the About dialog does there (`APP_ICON_COLORS`)', () => {
    const { light } = themes;
    expect(APP_ICON_COLORS).toEqual({ from: light['--accent-hover'], to: light['--accent'], glyph: light['--accent-contrast'] });
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG examples', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
    expect(contrastRatio(parseColor('#818b98').rgb, parseColor('#ffffff').rgb)).toBeCloseTo(3.45, 2);
  });
});
