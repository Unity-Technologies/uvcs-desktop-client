import { describe, expect, it } from 'vitest';
import { countCharactersRead } from '@shared/testing/countCharactersRead';
import { FOUND_ATTRIBUTE_TYPES, FOUND_ATTRIBUTE_VALUES } from './attributeRecords';
import { FOUND_REVIEWS } from './codeReviewRecords';
import { FOUND_BRANCHES, FOUND_CHANGESETS, FOUND_LABELS, FOUND_SHELVES } from './foundObjects';
import { recordsIn, recordsOutput } from './testing/cmOutput';

describe('found objects', () => {
  it('reads a branch with every field the lists show, its repository by name and server', () => {
    const output = recordsOutput(FOUND_BRANCHES, {
      id: 31266319,
      name: '/main/tâche-日本',
      parent: '/main',
      comment: 'Multi\nline "quoted"',
      owner: 'jane@acme.com',
      date: '2026-09-01T10:00:00.1234567+02:00',
      changeset: 12,
      guid: '9b8e2f7a-58f3-4c43-9d83-3c2f1f5c0001',
      repname: 'game',
      repserver: 'AcmeStudio@unity',
    });
    expect(recordsIn(output, FOUND_BRANCHES)).toEqual([
      {
        id: 31266319,
        name: '/main/tâche-日本',
        parent: '/main',
        comment: 'Multi\nline "quoted"',
        owner: 'jane@acme.com',
        date: '2026-09-01T10:00:00.1234567+02:00',
        headChangeset: 12,
        guid: '9b8e2f7a-58f3-4c43-9d83-3c2f1f5c0001',
        repository: 'game@AcmeStudio@unity',
      },
    ]);
  });

  // The lists showed comments, titles and values trimmed when they came from XML; they still do.
  it('trims the free text each list shows, and nothing else', () => {
    const branch = recordsIn(recordsOutput(FOUND_BRANCHES, { name: '/main/a ', owner: ' ana ', comment: '\n  Fix crash\n\n' }), FOUND_BRANCHES);
    const review = recordsIn(recordsOutput(FOUND_REVIEWS, { id: 1, title: ' Review it ', status: 'Status Reviewed' }), FOUND_REVIEWS);
    const values = recordsIn(recordsOutput(FOUND_ATTRIBUTE_VALUES, { name: 'notes', value: '- one\n' }), FOUND_ATTRIBUTE_VALUES);
    const others = [
      recordsIn(recordsOutput(FOUND_CHANGESETS, { comment: ' text\n' }), FOUND_CHANGESETS)[0]?.comment,
      recordsIn(recordsOutput(FOUND_LABELS, { comment: ' text\n' }), FOUND_LABELS)[0]?.comment,
      recordsIn(recordsOutput(FOUND_SHELVES, { comment: ' text\n' }), FOUND_SHELVES)[0]?.comment,
      recordsIn(recordsOutput(FOUND_ATTRIBUTE_TYPES, { comment: ' text\n' }), FOUND_ATTRIBUTE_TYPES)[0]?.comment,
    ];
    expect([branch[0]?.comment, branch[0]?.name, branch[0]?.owner, review[0]?.title, values[0]?.value, ...others]).toEqual(['Fix crash', '/main/a ', ' ana ', 'Review it', '- one', 'text', 'text', 'text', 'text']);
  });

  it('reads nothing from an empty output', () => {
    expect(recordsIn('', FOUND_CHANGESETS)).toEqual([]);
  });

  it('reads a root changeset, which has no parent', () => {
    const output = recordsOutput(FOUND_CHANGESETS, { changesetid: 0, parent: -1, branch: '/main', comment: 'Root dir', repname: 'game', repserver: 'local' });
    expect(recordsIn(output, FOUND_CHANGESETS)).toMatchObject([{ id: 0, parent: -1, branch: '/main', comment: 'Root dir', repository: 'game@local' }]);
  });

  it('reads records whose lines end with CRLF', () => {
    const output = recordsOutput(FOUND_LABELS, { id: 80, name: 'v1.0', changeset: 12 }, { id: 81, name: 'v1.1', changeset: 14 }).replaceAll('\n', '\r\n');
    expect(recordsIn(output, FOUND_LABELS).map(({ id, name, changeset }) => [id, name, changeset])).toEqual([
      [80, 'v1.0', 12],
      [81, 'v1.1', 14],
    ]);
  });

  it('reads shelves by number and attribute types with their repository', () => {
    expect(recordsIn(recordsOutput(FOUND_SHELVES, { shelveid: 9, parent: 5, comment: 'WIP' }), FOUND_SHELVES)).toMatchObject([{ id: 9, parentChangeset: 5, comment: 'WIP' }]);
    expect(recordsIn(recordsOutput(FOUND_ATTRIBUTE_TYPES, { id: 3, name: 'status', repname: 'game', repserver: 'local' }), FOUND_ATTRIBUTE_TYPES)).toMatchObject([
      { id: 3, name: 'status', repository: 'game@local' },
    ]);
  });

  it('reads the branches of a big repository in one pass: a few reads of each character, whatever the size', () => {
    const branches = Array.from({ length: 5_000 }, (_, id) => ({ id, name: `/main/task${id}`, parent: '/main', comment: `comment ${id}`, repname: 'game', repserver: 'local' }));
    const output = recordsOutput(FOUND_BRANCHES, ...branches);
    const { result, charactersRead } = countCharactersRead(() => recordsIn(output, FOUND_BRANCHES));
    expect(charactersRead / output.length).toBeLessThan(5);
    expect(result).toHaveLength(5_000);
  });
});
