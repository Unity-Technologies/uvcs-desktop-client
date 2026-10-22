import '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import { SEPARATOR, type Action, type MenuEntry } from '../../../lib/actions';
import { hotkey } from '../../../lib/shortcutRegistry';
import { lineMenu } from './lineMenu';

const labels = (menu: MenuEntry[]): string[] => menu.map((entry) => (entry === SEPARATOR ? '—' : (entry as Action).label));
const LINE = { side: 'new', first: 42, last: 42 } as const;
const RANGE = { side: 'new', first: 40, last: 52 } as const;

describe('lineMenu', () => {
  it('annotates, links to and copies the lines, in that order', () => {
    expect(labels(lineMenu({ lines: LINE, copyLink: vi.fn(), copyLines: vi.fn(), annotate: vi.fn() }))).toEqual(['Annotate at this line', '—', 'Copy link to line 42', 'Copy line']);
    expect(labels(lineMenu({ lines: RANGE, copyLink: vi.fn(), copyLines: vi.fn(), annotate: vi.fn() }))).toEqual(['Annotate at these lines', '—', 'Copy link to lines 40–52', 'Copy lines']);
  });

  it('shows the shortcut that copies the link', () => {
    const link = lineMenu({ lines: LINE, copyLink: vi.fn(), copyLines: vi.fn() }).find((entry) => entry !== SEPARATOR && (entry as Action).id === 'copyLineLink') as Action;
    expect(link.shortcut).toBe(hotkey('copyLink'));
  });

  it("annotates no older side's lines, nor where nothing can be annotated (an annotation itself)", () => {
    expect(labels(lineMenu({ lines: { ...LINE, side: 'old' }, copyLink: vi.fn(), copyLines: vi.fn(), annotate: vi.fn() }))).toEqual(['Copy link to line 42', 'Copy line']);
    expect(labels(lineMenu({ lines: LINE, copyLink: vi.fn(), copyLines: vi.fn() }))).toEqual(['Copy link to line 42', 'Copy line']);
  });

  it('copies only the text where no link names the lines', () => {
    expect(labels(lineMenu({ lines: LINE, copyLines: vi.fn() }))).toEqual(['Copy line']);
  });
});
