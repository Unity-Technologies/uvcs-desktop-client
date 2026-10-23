import { describe, expect, it } from 'vitest';
import { FOUND_BRANCHES, FOUND_CHANGESETS, foundObjects } from './foundObjects';
import { caseTolerantPattern, equalsCondition, findArgs, findQueryArgs, roundTripDate } from './findQuery';
import { FOUND_REVIEWS } from './codeReviewRecords';

const LABELS = foundObjects('label', ['name'], (value) => value('name'));

describe('findArgs', () => {
  it('combines filter conditions, order and limit', () => {
    expect(findArgs(FOUND_CHANGESETS, { owners: ['me'], sinceDate: '2026-01-01', limit: 50 }, 'changesetid desc')).toEqual([
      'find',
      'changeset',
      `where date >= '${roundTripDate('2026-01-01')}' and owner = 'me' order by changesetid desc limit 50`,
      '--format={changesetid}\u001f{guid}\u001f{branch}\u001f{comment}\u001f{owner}\u001f{date}\u001f{parent}\u001f{repname}\u001f{repserver}\u001e',
      '--dateformat=o',
      '--nototal',
    ]);
  });

  it('leaves out a query with no condition, order or limit', () => {
    expect(findArgs(LABELS, {}, null)).toEqual(['find', 'label', '--format={name}\u001e', '--dateformat=o', '--nototal']);
  });

  // With no workspace, nothing tells cm the repository; `on repository` anywhere but last fails ("missing EndOfFile").
  it('names the repository last, after the order and the limit, when no workspace tells cm which', () => {
    expect(findArgs(FOUND_BRANCHES, { limit: 5 }, 'date desc', ["hidden = 'false'"], 'game@local')[2]).toBe(
      "where hidden = 'false' order by date desc limit 5 on repository 'game@local'",
    );
    expect(findArgs(LABELS, {}, null, [], 'game@local')[2]).toBe("on repository 'game@local'");
    expect(findQueryArgs(FOUND_CHANGESETS, 'where changesetid = 12', 'game@acme@cloud')[2]).toBe(
      "where changesetid = 12 on repository 'game@acme@cloud'",
    );
  });

  // `--dateformat` sets how `cm` reads the dates written in the query too: a bare day would fail to parse.
  it('spells query days in the round-trip date format it asks dates in', () => {
    expect(roundTripDate('2026-08-26')).toMatch(/^2026-08-26T00:00:00\.0000000[+-]\d{2}:\d{2}$/);
  });

  it('searches the text in the field that describes each object', () => {
    expect(findArgs(FOUND_BRANCHES, { text: 'task' }, null)[2]).toBe("where name like '%ask%'");
    expect(findArgs(FOUND_REVIEWS, { text: 'fix', limit: 5 }, null)[2]).toBe("where title like '%ix%' limit 5");
  });

  // `cm find` reads no quote inside a value, neither doubled nor between double quotes ("Query error"), so a search
  // for "Everyone's shelves" used to fail. A quote matches any text instead; results are filtered precisely afterwards.
  it('searches text holding quotes with a wildcard in their place', () => {
    expect(findArgs(FOUND_CHANGESETS, { text: "don't" }, null)[2]).toBe("where comment like '%on%t%'");
    expect(findArgs(FOUND_BRANCHES, { text: "Everyone's shelves" }, null)[2]).toBe("where name like '%veryone%s%helves%'");
    expect(findArgs(FOUND_REVIEWS, { text: 'say "hi"' }, null)[2]).toBe("where title like '%ay%hi%%'");
  });

  it('ignores the case of the first letter of each word', () => {
    expect(caseTolerantPattern('bamboo  plugin')).toBe('%amboo%lugin%');
    expect(caseTolerantPattern('a fix')).toBe('%a%ix%');
  });

  it('asks for objects by any of several owners in one condition', () => {
    expect(findArgs(FOUND_BRANCHES, { owners: ['me', 'ana@corp.com'], sinceDate: '2026-01-01' }, null)[2]).toBe(
      `where date >= '${roundTripDate('2026-01-01')}' and (owner = 'me' or owner = 'ana@corp.com')`,
    );
    expect(findArgs(LABELS, { owners: [] }, null)).toEqual(findArgs(LABELS, {}, null));
  });

  // `cm find` rejects a quote inside an exact value too, doubled or not: such a value is matched with a wildcard in
  // each quote's place (more objects than asked for), and whoever needs the exact ones filters the results.
  it('matches a value holding quotes with a wildcard in their place', () => {
    expect(findArgs(FOUND_BRANCHES, { owners: ["o'neil@corp.com", 'ana'] }, null)[2]).toBe("where (owner like 'o%neil@corp.com' or owner = 'ana')");
    expect(equalsCondition('name', 'say "hi"')).toBe("name like 'say %hi%'");
    expect(equalsCondition('name', 'task')).toBe("name = 'task'");
  });
});
