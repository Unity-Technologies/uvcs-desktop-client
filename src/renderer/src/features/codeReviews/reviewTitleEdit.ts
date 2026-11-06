/** The title a rename saves: the one written, trimmed; none when it's empty or what the review is already called. */
export function titleToSave(current: string, written: string): string | null {
  const title = written.trim();
  return title === '' || title === current.trim() ? null : title;
}
