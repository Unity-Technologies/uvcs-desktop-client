/**
 * A `cm` command to copy into a terminal, naming `cm` as it runs: the bare `cm` when it is found on the PATH, else its
 * full path, quoted for the OS's own terminal: PowerShell on Windows (`& "C:\…\cm.exe"`: a quoted path alone is a
 * string there, not a command), a POSIX shell elsewhere (`'/Users/ana/Library/Application Support/…/cm'`).
 */
export function cmCommandLine(cmPath: string, args: string, platform: string): string {
  if (!/[\\/]/.test(cmPath)) return `cm ${args}`;
  if (platform === 'win32') return `& "${cmPath}" ${args}`;
  return `'${cmPath.replace(/'/g, `'\\''`)}' ${args}`;
}
