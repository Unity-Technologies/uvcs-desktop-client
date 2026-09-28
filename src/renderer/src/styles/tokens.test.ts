import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STABLE_HUES } from '../lib/stableHue';
import { composite, contrastRatio, hslColor, parseColor, themeTokens } from './contrast';

const themes = themeTokens(readFileSync(join(__dirname, 'tokens.css'), 'utf8'));

/** The opaque backgrounds text sits on. */
const SURFACES = ['--bg-app', '--bg-sidebar', '--bg-surface', '--bg-surface-raised', '--bg-subtle', '--bg-input', '--bg-code'];
/** Text down to 11px: WCAG AA asks 4.5:1. */
const TEXT = ['--text-primary', '--text-secondary', '--text-tertiary', '--accent-text', '--label-text', '--status-changed'];
/** Status letters on their own tint and focus rings are graphics: 3:1. */
const BADGES = ['--change-added', '--change-changed', '--change-deleted', '--change-moved', '--change-permissions', '--status-changed'];
const BADGE_TINT = 0.16;

function ratio(tokens: Record<string, string>, foreground: string, background: string): number {
  const behind = parseColor(tokens[background]!).rgb;
  return contrastRatio(composite(parseColor(tokens[foreground]!), behind), behind);
}

describe.each(Object.entries(themes))('%s theme', (_theme, tokens) => {
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

  // A graphic like the status letters: the name beside it says the same, so 3:1.
  it('draws the letter of a mark colored per name at 3:1 on its tint, for every hue, surface and row state', () => {
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

  it('keeps tertiary text quieter than secondary text', () => {
    expect(ratio(tokens, '--text-tertiary', '--bg-surface')).toBeLessThan(ratio(tokens, '--text-secondary', '--bg-surface'));
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG examples', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
    expect(contrastRatio(parseColor('#818b98').rgb, parseColor('#ffffff').rgb)).toBeCloseTo(3.45, 2);
  });
});
