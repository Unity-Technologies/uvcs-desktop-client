/** File names differ only in case on Linux; Windows and macOS (by default) treat `A.cs` and `a.cs` as one file. */
export function fileNamesIgnoreCase(platform: string): boolean {
  return platform !== 'linux';
}
