import { samePlace, type Place } from '@shared/domain/place';

/** A page window (by web contents id): the workspace window it belongs to, and whether it follows that one's selection. */
interface PageWindowEntry {
  owner: number;
  place: Place;
  following: boolean;
}

/** Who to tell after a page window started or stopped following: each page window whose state changed, and the owner. */
export interface FollowChanges {
  pageWindows: { viewer: number; following: boolean }[];
  owner: { viewer: number; followed: boolean } | null;
}

const NOTHING_CHANGED: FollowChanges = { pageWindows: [], owner: null };

/**
 * The page windows (a diff, a history… in a window of their own: `windows.openPage`) and the workspace windows they
 * belong to, by web contents id. A page window belongs to the window it was opened from, and at most one page window
 * of a workspace window follows its selection: the latest one asked.
 */
export class PageWindowRegistry {
  private readonly entries = new Map<number, PageWindowEntry>();

  add(viewer: number, owner: number, place: Place): void {
    this.entries.set(viewer, { owner, place, following: false });
  }

  /** The page window closed: its owner is told when it followed its selection. */
  remove(viewer: number): FollowChanges {
    const entry = this.entries.get(viewer);
    this.entries.delete(viewer);
    if (!entry?.following) return NOTHING_CHANGED;
    return { pageWindows: [], owner: { viewer: entry.owner, followed: false } };
  }

  isPageWindow(viewer: number): boolean {
    return this.entries.has(viewer);
  }

  /** The workspace window a page window belongs to; undefined for a workspace window. */
  ownerOf(viewer: number): number | undefined {
    return this.entries.get(viewer)?.owner;
  }

  /** The page windows of a workspace window, in the order they opened. */
  pageWindowsOf(owner: number): number[] {
    return [...this.entries].filter(([, entry]) => entry.owner === owner).map(([viewer]) => viewer);
  }

  /** The page windows of a place's window that show another place than the one it shows now (none: the home screen). */
  leftBehindBy(owner: number, place: Place | undefined): number[] {
    return [...this.entries].filter(([, entry]) => entry.owner === owner && (place === undefined || !samePlace(entry.place, place))).map(([viewer]) => viewer);
  }

  isFollowing(viewer: number): boolean {
    return this.entries.get(viewer)?.following ?? false;
  }

  /** The page window following a workspace window's selection, if one does. */
  followerOf(owner: number): number | undefined {
    for (const [viewer, entry] of this.entries) if (entry.owner === owner && entry.following) return viewer;
    return undefined;
  }

  /** A page window starts or stops following its owner's selection; starting stops the one that followed it before. */
  follow(viewer: number, following: boolean): FollowChanges {
    const entry = this.entries.get(viewer);
    if (!entry || entry.following === following) return NOTHING_CHANGED;
    const before = this.followerOf(entry.owner);
    const pageWindows: FollowChanges['pageWindows'] = [];
    if (following && before !== undefined) {
      this.entries.get(before)!.following = false;
      pageWindows.push({ viewer: before, following: false });
    }
    entry.following = following;
    pageWindows.push({ viewer, following });
    const ownerWasFollowed = before !== undefined;
    const owner = ownerWasFollowed === following ? null : { viewer: entry.owner, followed: following };
    return { pageWindows, owner };
  }
}
