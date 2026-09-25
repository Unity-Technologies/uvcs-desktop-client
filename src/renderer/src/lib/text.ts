/** The summary line of a multi-line comment. */
export function firstLine(text: string): string {
  return text.trimStart().split('\n')[0]?.trim() ?? '';
}

export function fileNameOf(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
