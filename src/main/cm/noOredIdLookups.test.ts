import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/**
 * `cm find` has no `in (...)`, and ids ORed together (`where id = 1 or id = 2 or …`) take a server query per few
 * dozen ids. Names and details come with the queries that list the objects (`--format` fields, branch lists with
 * `{id}`), or from one bounded query the view needs anyway (`readBranchNames`). This scans the sources for code that
 * builds such conditions.
 */

const SOURCE_DIRECTORY = join(__dirname, '..', '..');

/** `.join(' or ')` and friends: conditions glued together from a list. */
const JOINED_WITH_OR = /\.join\(\s*(['"`])\s*or\s*\1\s*\)/i;
/** A literal comparing an id and ORing another condition, e.g. `where id = ${a} or id = ${b}`. */
const ORED_ID_LITERAL = /['"`][^'"`\n]*\bid\s*=\s*[^'"`\n]*\bor\b[^'"`\n]*['"`]/i;

/** Owners are names picked by hand, a few at most (`ownersCondition`): ORing them is one bounded scan, not a lookup per id. */
const OWNERS_CONDITION = /\bowner = /;

function oredIdLookups(source: string): string[] {
  const lines = source.split('\n');
  return lines.filter((line, index) => {
    if (ORED_ID_LITERAL.test(line)) return true;
    if (!JOINED_WITH_OR.test(line)) return false;
    // The conditions joined are built on the line itself or the one before.
    return !OWNERS_CONDITION.test(`${lines[index - 1] ?? ''}\n${line}`);
  });
}

describe('no ORed id lookups', () => {
  it('spots conditions built by ORing ids', () => {
    expect(oredIdLookups("return `where ${ids.map((id) => `id = ${id}`).join(' or ')}`;")).toHaveLength(1);
    expect(oredIdLookups("cm.query(['find', 'branch', 'where id = 1 or id = 2'])")).toHaveLength(1);
    expect(oredIdLookups("cm.query(['find', 'review', `id = ${reviewId}`])")).toEqual([]);
    expect(oredIdLookups("const where = `where name = '${name}'`;")).toEqual([]);
    expect(oredIdLookups("const each = owners.map((owner) => `owner = '${owner}'`);\nreturn `(${each.join(' or ')})`;")).toEqual([]);
  });

  it('no source builds one', () => {
    const offenders = filesUnder(SOURCE_DIRECTORY, isAppSource).flatMap((file) =>
      oredIdLookups(readFileSync(file, 'utf8')).map((line) => `${relative(SOURCE_DIRECTORY, file)}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
