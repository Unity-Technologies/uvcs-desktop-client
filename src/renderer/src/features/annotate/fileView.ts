/** How a file shows beside a list: its diff, or who last changed each of its lines. */
export type FileView = 'diff' | 'annotate';

export function otherFileView(view: FileView): FileView {
  return view === 'diff' ? 'annotate' : 'diff';
}
