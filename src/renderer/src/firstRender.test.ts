import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The window shows on its page's first frame (`ready-to-show`). React renders a root on a later task, so without
 * `flushSync` that frame came before the app's first commit in most launches, and the window showed its background
 * alone (ARCHITECTURE.md "Start-up").
 */
describe('the first render', () => {
  it('commits the app synchronously, before the page can paint its first frame', () => {
    const entry = readFileSync(join(__dirname, 'main.tsx'), 'utf8');
    expect(entry).toMatch(/flushSync\(\(\) =>\s*root\.render\(/);
    expect(entry.match(/\.render\(/g)).toHaveLength(1);
  });
});
