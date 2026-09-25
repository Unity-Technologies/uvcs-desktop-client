import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `cm find` has no `in (...)`, and ids ORed together (`where id = 1 or id = 2 or …`) take a server query per few
 * dozen ids. Names and details come with the queries that list the objects (`--format` fields, branch lists with
 * `{id}`), or from one bounded query the view needs anyway (`readBranchNames`). This scans the sources for code that
 * builds such conditions.
 */

const SOURCE_DIRECTORY = join(__dirname, '..', '..');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** `.join(' or ')` and friends: conditions glued together from a list. */
const JOINED_WITH_OR = /\.join\(\s*(['"`])\s*or\s*\1\s*\)/i;
/** A literal comparing an id and ORing another condition, e.g. `where id = ${a} or id = ${b}`. */
const ORED_ID_LITERAL = /['"`][^'"`\n]*\bid\s*=\s*[^'"`\n]*\bor\b[^'"`\n]*['"`]/i;

function oredIdLookups(source: string): string[] {
  return source.split('\n').filter((line) => JOINED_WITH_OR.test(line) || ORED_ID_LITERAL.test(line));
}

describe('no ORed id lookups', () => {
  it('spots conditions built by ORing ids', () => {
    expect(oredIdLookups("return `where ${ids.map((id) => `id = ${id}`).join(' or ')}`;")).toHaveLength(1);
    expect(oredIdLookups("cm.query(['find', 'branch', 'where id = 1 or id = 2'])")).toHaveLength(1);
    expect(oredIdLookups("cm.query(['find', 'review', `id = ${reviewId}`])")).toEqual([]);
    expect(oredIdLookups("const where = `where name = '${name}'`;")).toEqual([]);
  });

  it('no source builds one', () => {
    const offenders = sourceFiles(SOURCE_DIRECTORY).flatMap((file) =>
      oredIdLookups(readFileSync(file, 'utf8')).map((line) => `${relative(SOURCE_DIRECTORY, file)}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
