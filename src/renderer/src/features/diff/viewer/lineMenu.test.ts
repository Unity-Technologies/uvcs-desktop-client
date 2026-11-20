import '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import { SEPARATOR, type Action, type MenuEntry } from '../../../lib/actions';
import { hotkey } from '../../../lib/shortcutRegistry';
import { groupedMenu } from '../../../lib/menuGroups';
import type { LineAction } from './diffAnnotations';
import { lineActionTarget, lineActionTargetAt, lineMenuEntries } from './lineMenu';

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

describe("a place's own action on a line", () => {
  const onNewerSide: LineAction = {
    offers: (line) => line.side === 'additions',
    label: (lines) => `Comment on lines ${lines.firstLineNumber}–${lines.lineNumber}`,
    run: vi.fn(),
  };

  it('comes first, on the lines selected', () => {
    const menu = linesMenu({ lines: RANGE, copyLines: vi.fn(), lineAction: onNewerSide });
    expect(labels(menu)).toEqual(['Comment on lines 40–52', '—', 'Copy lines']);
    (menu[0] as Action).run();
    expect(onNewerSide.run).toHaveBeenCalledWith({ side: 'additions', firstLineNumber: 40, lineNumber: 52 });
  });

  it("isn't offered on lines the place doesn't take", () => {
    expect(labels(linesMenu({ lines: { ...LINE, side: 'old' }, copyLines: vi.fn(), lineAction: onNewerSide }))).toEqual(['Copy line']);
  });

  it('offers its other way right after it, on the same lines', () => {
    const suggest = vi.fn();
    const withVariant: LineAction = { ...onNewerSide, variant: { label: (lines) => `Suggest change on lines ${lines.firstLineNumber}–${lines.lineNumber}`, run: suggest } };
    const menu = linesMenu({ lines: RANGE, copyLines: vi.fn(), lineAction: withVariant });
    expect(labels(menu)).toEqual(['Comment on lines 40–52', 'Suggest change on lines 40–52', '—', 'Copy lines']);
    (menu[1] as Action).run();
    expect(suggest).toHaveBeenCalledWith({ side: 'additions', firstLineNumber: 40, lineNumber: 52 });
    expect(labels(linesMenu({ lines: { ...LINE, side: 'old' }, copyLines: vi.fn(), lineAction: withVariant }))).toEqual(['Copy line']);
  });

  it('names the older side as the diff does', () => {
    expect(lineActionTarget({ side: 'old', first: 3, last: 7 })).toEqual({ side: 'deletions', firstLineNumber: 3, lineNumber: 7 });
  });
});

describe('lineActionTargetAt', () => {
  const selected = { side: 'new', first: 40, last: 52 } as const;

  it("acts on the lines selected from the button of any of them", () => {
    expect(lineActionTargetAt({ side: 'additions', lineNumber: 40 }, selected)).toEqual({ side: 'additions', firstLineNumber: 40, lineNumber: 52 });
    expect(lineActionTargetAt({ side: 'additions', lineNumber: 45 }, selected)).toEqual({ side: 'additions', firstLineNumber: 40, lineNumber: 52 });
  });

  it('acts on its own line outside the selection, on the other side, or with nothing selected', () => {
    expect(lineActionTargetAt({ side: 'additions', lineNumber: 53 }, selected)).toEqual({ side: 'additions', firstLineNumber: 53, lineNumber: 53 });
    expect(lineActionTargetAt({ side: 'deletions', lineNumber: 45 }, selected)).toEqual({ side: 'deletions', firstLineNumber: 45, lineNumber: 45 });
    expect(lineActionTargetAt({ side: 'additions', lineNumber: 45 }, null)).toEqual({ side: 'additions', firstLineNumber: 45, lineNumber: 45 });
  });
});
