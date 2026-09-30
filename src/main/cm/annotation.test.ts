import { describe, expect, it } from 'vitest';
import { parseAnnotation } from './annotation';
import { formatOutput } from './testing/cmOutput';


describe('parseAnnotation', () => {
  it('keeps line contents and deduplicates changeset details', () => {
    const output =
      formatOutput(['1', '1', 'jane@example.com', '2026-09-01T10:00:00+02:00', 'br:/main', 'No', 'Initial import', 'export const a = 1;']) +
      formatOutput(['2', '4', 'bob@example.com', '2026-09-20T10:00:00+02:00', 'br:/main/ui', 'Yes', 'Multi\nline', '  return a;\r']) +
      formatOutput(['3', '1', 'jane@example.com', '2026-09-01T10:00:00+02:00', 'br:/main', 'No', 'Initial import', '']);

    const annotation = parseAnnotation(output);

    expect(annotation.lines).toEqual([
      { lineNumber: 1, content: 'export const a = 1;', changesetId: 1 },
      { lineNumber: 2, content: '  return a;', changesetId: 4 },
      { lineNumber: 3, content: '', changesetId: 1 },
    ]);
    expect(annotation.changesets).toEqual([
      { changesetId: 1, owner: 'jane@example.com', date: '2026-09-01T10:00:00+02:00', branch: '/main', comment: 'Initial import', isMerge: false },
      { changesetId: 4, owner: 'bob@example.com', date: '2026-09-20T10:00:00+02:00', branch: '/main/ui', comment: 'Multi\nline', isMerge: true },
    ]);
  });
});
