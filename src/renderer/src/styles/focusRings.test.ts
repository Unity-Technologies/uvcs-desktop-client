/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor, themeTokens } from './contrast';

const RENDERER = join(__dirname, '..');
const themes = themeTokens(readFileSync(join(__dirname, 'tokens.css'), 'utf8'));

function cssModules(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return cssModules(path);
    return name.endsWith('.module.css') ? [path] : [];
  });
}

interface Rule {
  file: string;
  selector: string;
  body: string;
}

/** The innermost `selector { body }` blocks of every CSS module (inside @media too), one per selector of a list. */
const rules: Rule[] = cssModules(RENDERER).flatMap((path) => {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selectors, body]) =>
    selectors!.split(',').map((selector) => ({ file: relative(RENDERER, path).split(sep).join('/'), selector: selector.trim(), body: body! })),
  );
});

const rulesOf = (file: string, selector: string): Rule[] => rules.filter((rule) => rule.file === file && rule.selector === selector);

describe('focus rings', () => {
  // The global ring is a box-shadow on :focus-visible; a state selector is more specific, so its own shadow would win.
  it('stay visible on checked, pressed and active controls that draw a shadow of their own', () => {
    // An open trigger has handed focus to its popup; an attribute chip is a frame around the button that takes focus.
    const state = /\[(?:aria-checked|aria-pressed|aria-selected|data-state(?!='open')|data-active)=[^\]]+\]$/;
    const notFocusable = new Set(["features/attributes/AttributeChips.module.css: .chip[data-active='true']"]);
    const offenders = rules
      .filter((rule) => state.test(rule.selector) && /box-shadow:(?!\s*none)/.test(rule.body))
      .filter((rule) => !notFocusable.has(`${rule.file}: ${rule.selector}`))
      .filter((rule) => !rules.some((other) => other.file === rule.file && other.selector === `${rule.selector}:focus-visible`))
      .map((rule) => `${rule.file}: ${rule.selector}`);
    expect(offenders).toEqual([]);
  });

  it('come with the controls that only show on hover, which show for the keyboard too', () => {
    const offenders = rules
      .filter((rule) => /opacity:\s*1\b/.test(rule.body))
      .flatMap((rule) => {
        const target = /:hover\s+(\.[\w-]+)$/.exec(rule.selector)?.[1];
        if (!target) return [];
        const revealed = rules.some(
          (other) =>
            other.file === rule.file &&
            /opacity:\s*1\b/.test(other.body) &&
            [`${target}:focus-visible`, `${target}:focus-within`, `:focus-visible ${target}`, `:focus-within ${target}`].some((focus) => other.selector.includes(focus)),
        );
        return revealed ? [] : [`${rule.file}: ${rule.selector}`];
      });
    expect(offenders).toEqual([]);
  });

  it.each(Object.entries(themes))('are drawn apart from an accent fill in the %s theme, where they would melt into it', (_theme, tokens) => {
    expect(contrastRatio(parseColor(tokens['--focus-color']!).rgb, parseColor(tokens['--accent']!).rgb)).toBeLessThan(3);
    for (const selector of ['.primary:focus-visible', '.danger:focus-visible']) {
      expect(rulesOf('ui/Button.module.css', selector).map((rule) => rule.body).join(), selector).toMatch(/outline-offset:\s*2px/);
    }
    for (const selector of [".box[data-state='checked']:focus-visible", ".box[data-state='mixed']:focus-visible"]) {
      expect(rulesOf('ui/Checkbox.module.css', selector).map((rule) => rule.body).join(), selector).toMatch(/outline-offset:\s*2px/);
    }
  });
});
