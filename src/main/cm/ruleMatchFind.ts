import type { RuleObject, RuleQuery } from '@shared/domain/branchExplorer';
import { queryOn } from './findQuery';
import { recordFormat, type ReadRecord } from './formatRecords';

/** The one field a rule's answer needs of each object: what the Branch Explorer knows it by. */
const MATCHED_FIELD: Record<RuleObject, string> = { branch: 'name', changeset: 'changesetid', label: 'name' };

/**
 * The `cm find` that answers one Branch Explorer rule: the objects meeting its condition, each printed as just the
 * field `MATCHED_FIELD` names, on `repository` when no workspace tells `cm` which. The condition goes in as the user
 * wrote it: `cm` checks it, and says why when it can't read it.
 *
 * Not `findCommand`: its `--dateformat` also applies to the dates written in the query (`roundTripDate`), so a user's
 * `date >= '2026-01-01'` would have to be spelled in that format. Nothing printed here is a date.
 */
export function ruleMatchFind(query: RuleQuery, repository?: string): string[] {
  const format = `--format=${recordFormat([MATCHED_FIELD[query.object]])}`;
  return ['find', query.object, queryOn(`where ${query.condition}`, repository), format, '--nototal'];
}

/** Each record of a `ruleMatchFind`: the matched object's name or id. */
export const matchedObject: ReadRecord<string> = ([value = '']) => value || undefined;
