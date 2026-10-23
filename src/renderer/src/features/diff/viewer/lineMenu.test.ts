import '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import { SEPARATOR, type Action, type MenuEntry } from '../../../lib/actions';
import { hotkey } from '../../../lib/shortcutRegistry';
import { groupedMenu } from '../../../lib/menuGroups';
import { lineMenuEntries } from './lineMenu';

/** The lines' entries as a menu of their own reads them. */
const linesMenu = (context: Parameters<typeof lineMenuEntries>[0]): MenuEntry[] => groupedMenu(lineMenuEntries(context));

const labels = (menu: MenuEntry[]): string[] => menu.map((entry) => (entry === SEPARATOR ? '—' : (entry as Action).label));
const LINE = { side: 'new', first: 42, last: 42 } as const;
const RANGE = { side: 'new', first: 40, last: 52 } as const;

describe('lineMenuEntries', () => {
  it('annotates, links to and copies the lines, in that order', () => {
    expect(labels(linesMenu({ lines: LINE, copyLink: vi.fn(), copyLines: vi.fn(), annotate: vi.fn() }))).toEqual(['Annotate at this line', '—', 'Copy link to line 42', 'Copy line']);
    expect(labels(linesMenu({ lines: RANGE, copyLink: vi.fn(), copyLines: vi.fn(), annotate: vi.fn() }))).toEqual(['Annotate at these lines', '—', 'Copy link to lines 40–52', 'Copy lines']);
  });

  it('shows the shortcut that copies the link', () => {
    const link = linesMenu({ lines: LINE, copyLink: vi.fn(), copyLines: vi.fn() }).find((entry) => entry !== SEPARATOR && (entry as Action).id === 'copyLineLink') as Action;
    expect(link.shortcut).toBe(hotkey('copyLink'));
  });

  it("annotates no older side's lines, nor where nothing can be annotated (an annotation itself)", () => {
    expect(labels(linesMenu({ lines: { ...LINE, side: 'old' }, copyLink: vi.fn(), copyLines: vi.fn(), annotate: vi.fn() }))).toEqual(['Copy link to line 42', 'Copy line']);
    expect(labels(linesMenu({ lines: LINE, copyLink: vi.fn(), copyLines: vi.fn() }))).toEqual(['Copy link to line 42', 'Copy line']);
  });

  it('copies only the text where no link names the lines', () => {
    expect(labels(linesMenu({ lines: LINE, copyLines: vi.fn() }))).toEqual(['Copy line']);
  });
});
