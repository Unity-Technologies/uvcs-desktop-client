import type { Annotation, AnnotationChangeset } from '@shared/domain/annotate';
import { recordFormat } from './formatRecords';

/** The line content goes last so nothing after it can be confused with it. */
export const ANNOTATE_FORMAT = recordFormat(['line', 'changeset', 'owner', 'date', 'branch', 'ismergerev', 'comment', 'content']);
export const ANNOTATE_DATE_FORMAT = 'yyyy-MM-ddTHH:mm:sszzz';

/**
 * The annotation of `cm annotate`'s records (`readFields`, read as they arrive: a big file prints a record per line),
 * keeping each changeset's details once instead of per line.
 */
export function annotationOf(records: readonly string[][]): Annotation {
  const changesets = new Map<number, AnnotationChangeset>();

  const lines = records.map(([line = '', changeset = '', owner = '', date = '', branch = '', isMerge = '', comment = '', content = '']) => {
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
