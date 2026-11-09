import type { ReleaseNotes } from '@shared/domain/appUpdate';

/**
 * The notes electron-updater read with an update: one string for the latest release, or, with `fullChangelog` on
 * (`createAppUpdates`), every release between the running version and the latest, newest first.
 */
export type FeedReleaseNotes = string | ReadonlyArray<{ version: string; note: string | null }> | null | undefined;

/**
 * The notes of an update found for version `version`, newest first, leaving out the releases published without any.
 * `releaseDate` (electron-updater's `UpdateInfo.releaseDate`, from the update's `latest*.yml`) dates that version alone.
 */
export function releaseNotesOf(notes: FeedReleaseNotes, version: string, releaseDate?: string): ReleaseNotes[] {
  const all = typeof notes === 'string' ? [{ version, html: notes }] : (notes ?? []).map(({ version, note }) => ({ version, html: note ?? '' }));
  return all
    .filter((release) => release.html.trim() !== '')
    .map((release) => (releaseDate && release.version === version ? { ...release, releaseDate } : release));
}
