import { describe, expect, it } from 'vitest';
import { recordFormat } from './formatRecords';
import { matchedObject, ruleMatchFind } from './ruleMatchFind';

describe('ruleMatchFind', () => {
  it('finds the objects meeting the condition, printing only what the Branch Explorer knows them by', () => {
    expect(ruleMatchFind({ object: 'branch', condition: "owner = 'ana'" }).slice(0, 4)).toEqual([
      'find',
      'branch',
      "where owner = 'ana'",
      `--format=${recordFormat(['name'])}`,
    ]);
    expect(ruleMatchFind({ object: 'changeset', condition: "date >= '2026-01-01'" })[3]).toBe(`--format=${recordFormat(['changesetid'])}`);
    expect(ruleMatchFind({ object: 'label', condition: "name like 'v%'" })[3]).toBe(`--format=${recordFormat(['name'])}`);
  });

  it("leaves the dates in the user's condition as they wrote them: no --dateformat, which would apply to them too", () => {
    expect(ruleMatchFind({ object: 'changeset', condition: "date >= '2026-01-01'" })).toEqual([
      'find',
      'changeset',
      "where date >= '2026-01-01'",
      `--format=${recordFormat(['changesetid'])}`,
      '--nototal',
    ]);
  });

  it('asks a repository by name when no workspace tells cm which', () => {
    expect(ruleMatchFind({ object: 'label', condition: "name like 'v%'" }, 'game@local')[2]).toBe("where name like 'v%' on repository 'game@local'");
  });
});

describe('matchedObject', () => {
  it('reads the name or id, and skips an empty record', () => {
    expect(matchedObject(['/main/task1'])).toBe('/main/task1');
    expect(matchedObject([''])).toBeUndefined();
  });
});
