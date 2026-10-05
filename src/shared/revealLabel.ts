/** What the OS calls showing an item in its file manager: Finder, Explorer, or whichever a Linux desktop runs. */
export function revealLabel(platform: string): string {
  if (platform === 'darwin') return 'Reveal in Finder';
  if (platform === 'win32') return 'Show in Explorer';
  return 'Show in file manager';
}

/** What the OS calls opening a folder in its file manager, showing what it holds: the workspace's own folder. */
export function openInFileManagerLabel(platform: string): string {
  if (platform === 'darwin') return 'Open in Finder';
  if (platform === 'win32') return 'Open in Explorer';
  return 'Open in file manager';
}
