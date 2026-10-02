/** The name a program goes by, from its path: the macOS app it's inside, or its file without the launcher's extension. */
export function programName(executable: string): string {
  const parts = executable.split(/[\\/]/);
  const app = parts.find((part) => part.endsWith('.app'));
  return (app ?? parts.pop() ?? executable).replace(/\.(app|exe|cmd|bat)$/i, '');
}
