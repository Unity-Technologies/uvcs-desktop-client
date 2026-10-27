import type { AnnotatedLine, Annotation, AnnotationChangeset } from '@shared/domain/annotate';
import { recordFormat, type ReadRecord } from './formatRecords';

/** The line content goes last so nothing after it can be confused with it. */
export const ANNOTATE_FORMAT = recordFormat(['line', 'changeset', 'owner', 'date', 'branch', 'ismergerev', 'comment', 'content']);
export const ANNOTATE_DATE_FORMAT = 'yyyy-MM-ddTHH:mm:sszzz';

/**
 * Reads `cm annotate`'s records as they arrive (`read`, for `queryRecords`): a big file prints a record per line, so
 * each line keeps only its number, content and changeset, and each changeset's details are kept once, the first time
 * a line of it arrives.
 */
export class AnnotationReader {
  private readonly changesets = new Map<number, AnnotationChangeset>();

  readonly read: ReadRecord<AnnotatedLine> = ([line = '', changeset = '', owner = '', date = '', branch = '', isMerge = '', comment = '', content = '']) => {
    const changesetId = Number(changeset);
    if (!this.changesets.has(changesetId)) {
      this.changesets.set(changesetId, { changesetId, owner, date, branch: branch.replace(/^br:/, ''), comment, isMerge: /^(yes|true)$/i.test(isMerge) });
    }
    return { lineNumber: Number(line), content: content.replace(/\r$/, ''), changesetId };
  };

  /** The annotation of the lines read, with the changesets they came from. */
  annotation(lines: AnnotatedLine[]): Annotation {
    return { lines, changesets: [...this.changesets.values()] };
  }
}
