/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder } from '@shared/testing/filesUnder';

const RENDERER = join(__dirname, '..');

/**
 * A color written out (`#fff`, `rgb(…)`, `hsl(…)` with a number in it) rather than taken from a token of `tokens.css`.
 * An `hsl()` made of tokens alone (a tint's `var(--hue) var(--tint-bg-saturation) …`) is the tokens' own color.
 */
const RAW_COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(.*\d%/i;

/**
 * Where a color written out is what is meant, not a style: a mask's opaque stop (only its alpha counts), the color of a
 * pixel the image diff inspects, a branch's dot in the colors the Branch Explorer's canvas draws it with (`hueToColor`),
 * and the progress bar's passing light, the same white over the accent in both themes.
 */
const ALLOWED: { file: string; line: RegExp }[] = [
  { file: '*.css', line: /^\s*mask-image:/ },
  { file: 'features/diff/viewer/image/PixelInspector.tsx', line: /const color = `rgba\(\$\{rgba\[0\]\}/ },
  { file: 'features/branchExplorer/details/BranchName.module.css', line: /background: hsl\(var\(--branch-hue\) \d+% \d+%\);/ },
  { file: 'app/operations/ProgressTrack.module.css', line: /rgba\(255, 255, 255, 0\.35\)/ },
];

function rawColors(path: string): string[] {
  const file = relative(RENDERER, path).split(sep).join('/');
  const allowed = ALLOWED.filter((rule) => rule.file === file || (rule.file === '*.css' && file.endsWith('.css')));
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .split('\n')
    .flatMap((line, index) => (RAW_COLOR.test(line) && !allowed.some((rule) => rule.line.test(line)) ? [`${file}:${index + 1}: ${line.trim()}`] : []));
}

describe('colors', () => {
  // Every color comes from `styles/tokens.css`, where the contrast tests check it in both themes (`tokens.test.ts`).
  it('are never written out in styles or components, only in the tokens', () => {
    const sources = filesUnder(RENDERER, (name) => /\.(css|tsx)$/.test(name)).filter((path) => !path.endsWith(join('styles', 'tokens.css')));
    expect(sources.flatMap(rawColors)).toEqual([]);
  });
});
