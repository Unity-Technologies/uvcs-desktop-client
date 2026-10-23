import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CmError } from './CmError';
import { isPurgedRevisionError, purgedTargetOf } from './purgedRevision';

const TARGET = join('tmp', 'uvcs-1234', 'a.png');
const PURGED = `Can't retrieve the content of the file '${TARGET}' because the revision (id:13) was purged and its content is no longer available.`;

function failure(message: string): CmError {
  return new CmError(message, { commandLine: 'cm cat revid:13@game@local', exitCode: 1, output: message, logEntryId: 1 });
}

describe('isPurgedRevisionError', () => {
  it("tells cm cat's failure on a revision a purge removed", () => {
    expect(isPurgedRevisionError(failure(PURGED))).toBe(true);
  });

  it('tells it among the lines of a batch, CRLF included', () => {
    expect(isPurgedRevisionError(failure(`Something else\r\n${PURGED}\r\n`))).toBe(true);
  });

  it('is no other failure: a revision not found, a file whose name says "purged", a failure that is not cm\'s', () => {
    expect(isPurgedRevisionError(failure('The specified revision was not found revid:13@game@local'))).toBe(false);
    expect(isPurgedRevisionError(failure("The item /was purged.txt does not exist."))).toBe(false);
    expect(isPurgedRevisionError(new Error(PURGED))).toBe(false);
  });
});

describe('purgedTargetOf', () => {
  it('reads the file the revision was to be written to, as cm cat was given it', () => {
    expect(purgedTargetOf(PURGED)).toBe(TARGET);
  });

  it("reads a file whose name holds a quote and ' because ' whole", () => {
    const odd = join('tmp', "it's here because 'x'.txt");
    expect(purgedTargetOf(`Can't retrieve the content of the file '${odd}' because the revision (id:7) was purged and its content is no longer available.`)).toBe(odd);
  });

  it('is null for any other line', () => {
    expect(purgedTargetOf('The specified revision was not found revid:13@game@local')).toBeNull();
  });
});
