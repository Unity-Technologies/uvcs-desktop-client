import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { PageWindowRegistry } from './PageWindowRegistry';

const GAME = workspacePlace(join('/work', 'game'));
const TOOLS = workspacePlace(join('/work', 'tools'));
const MAIN = 1;
const OTHER_MAIN = 2;

function registry(): PageWindowRegistry {
  const pages = new PageWindowRegistry();
  pages.add(10, MAIN, GAME);
  pages.add(11, MAIN, GAME);
  pages.add(20, OTHER_MAIN, TOOLS);
  return pages;
}

describe('page windows', () => {
  it('belong to the workspace window they were opened from', () => {
    const pages = registry();

    expect(pages.pageWindowsOf(MAIN)).toEqual([10, 11]);
    expect(pages.ownerOf(20)).toBe(OTHER_MAIN);
    expect(pages.ownerOf(MAIN)).toBeUndefined();
    expect(pages.isPageWindow(10)).toBe(true);
    expect(pages.isPageWindow(MAIN)).toBe(false);
  });

  it("are left behind when their workspace window shows another workspace or the home screen, and not when it shows theirs", () => {
    const pages = registry();

    expect(pages.leftBehindBy(MAIN, GAME)).toEqual([]);
    expect(pages.leftBehindBy(MAIN, TOOLS)).toEqual([10, 11]);
    expect(pages.leftBehindBy(MAIN, undefined)).toEqual([10, 11]);
    expect(pages.leftBehindBy(MAIN, repositoryPlace('game@local'))).toEqual([10, 11]);
  });

  it('are forgotten once closed', () => {
    const pages = registry();

    pages.remove(10);
    expect(pages.pageWindowsOf(MAIN)).toEqual([11]);
    expect(pages.isPageWindow(10)).toBe(false);
  });
});

describe('following the selection', () => {
  it("tells the page window and its workspace window, which then shows its selection to it", () => {
    const pages = registry();

    expect(pages.follow(10, true)).toEqual({ pageWindows: [{ viewer: 10, following: true }], owner: { viewer: MAIN, followed: true } });
    expect(pages.followerOf(MAIN)).toBe(10);
    expect(pages.followerOf(OTHER_MAIN)).toBeUndefined();
  });

  it('is one page window per workspace window: the latest one takes it from the one before, the owner still followed', () => {
    const pages = registry();
    pages.follow(10, true);

    expect(pages.follow(11, true)).toEqual({
      pageWindows: [
        { viewer: 10, following: false },
        { viewer: 11, following: true },
      ],
      owner: null,
    });
    expect(pages.followerOf(MAIN)).toBe(11);
  });

  it("doesn't take it from another workspace window's page window", () => {
    const pages = registry();
    pages.follow(20, true);

    pages.follow(10, true);
    expect(pages.followerOf(OTHER_MAIN)).toBe(20);
  });

  it('stops when asked or when the page window closes, telling the owner nothing follows it anymore', () => {
    const pages = registry();
    pages.follow(10, true);
    expect(pages.follow(10, false)).toEqual({ pageWindows: [{ viewer: 10, following: false }], owner: { viewer: MAIN, followed: false } });

    pages.follow(11, true);
    expect(pages.remove(11)).toEqual({ pageWindows: [], owner: { viewer: MAIN, followed: false } });
    expect(pages.followerOf(MAIN)).toBeUndefined();
  });

  it('tells no one when nothing changes', () => {
    const pages = registry();
    const nothing = { pageWindows: [], owner: null };

    expect(pages.follow(10, false)).toEqual(nothing);
    expect(pages.follow(99, true)).toEqual(nothing);
    expect(pages.remove(11)).toEqual(nothing);
  });
});
