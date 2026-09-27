/** An example of a program's path, as the OS writes one. */
export function programPlaceholder(platform: string): string {
  return platform === 'win32' ? 'C:\\Program Files\\Tool\\tool.exe' : '/path/to/tool';
}
