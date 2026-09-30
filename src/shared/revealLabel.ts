/** What the OS calls showing an item in its file manager: Finder, Explorer, or whichever a Linux desktop runs. */
export function revealLabel(platform: string): string {
  if (platform === 'darwin') return 'Reveal in Finder';
  if (platform === 'win32') return 'Show in Explorer';
  return 'Show in file manager';
}
