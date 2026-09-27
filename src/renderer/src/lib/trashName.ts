/** What the OS calls the place deleted files go to until it's emptied, lowercase where it's no name of its own. */
export function trashName(platform: string): string {
  return platform === 'win32' ? 'Recycle Bin' : 'trash';
}
