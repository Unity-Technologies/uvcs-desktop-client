import type { Annotation, AnnotationChangeset } from '@shared/domain/annotate';
import { parseRecords, recordFormat } from './formatRecords';

/** The line content goes last so nothing after it can be confused with it. */
export const ANNOTATE_FORMAT = recordFormat(['line', 'changeset', 'owner', 'date', 'branch', 'ismergerev', 'comment', 'content']);
export const ANNOTATE_DATE_FORMAT = 'yyyy-MM-ddTHH:mm:sszzz';

/** Parses `cm annotate` records, keeping each changeset's details once instead of per line. */
export function parseAnnotation(output: string): Annotation {
  const changesets = new Map<number, AnnotationChangeset>();

  const lines = parseRecords(output).map(([line = '', changeset = '', owner = '', date = '', branch = '', isMerge = '', comment = '', content = '']) => {
    const changesetId = Number(changeset);
    if (!changesets.has(changesetId)) {
      changesets.set(changesetId, {
        changesetId,
        owner,
        date,
        branch: branch.replace(/^br:/, ''),
        comment,
        isMerge: /^(yes|true)$/i.test(isMerge),
      });
    }
    return { lineNumber: Number(line), content: content.replace(/\r$/, ''), changesetId };
  });

  return { lines, changesets: [...changesets.values()] };
}
