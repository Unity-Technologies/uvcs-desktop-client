import type { RuleObject, RuleQuery } from '@shared/domain/branchExplorer';
import { findCommand } from './findQuery';
import { recordFormat, type ReadRecord } from './formatRecords';

/** The one field a rule's answer needs of each object: what the Branch Explorer knows it by. */
const MATCHED_FIELD: Record<RuleObject, string> = { branch: 'name', changeset: 'changesetid', label: 'name' };

/**
 * The `cm find` that answers one Branch Explorer rule: the objects meeting its condition, each printed as just the
 * field `MATCHED_FIELD` names, on `repository` when no workspace tells `cm` which. The condition goes in as the user
 * wrote it: `cm` checks it, and says why when it can't read it.
 */
export function ruleMatchFind(query: RuleQuery, repository?: string): string[] {
  return findCommand(query.object, `where ${query.condition}`, `--format=${recordFormat([MATCHED_FIELD[query.object]])}`, repository);
}

/** Each record of a `ruleMatchFind`: the matched object's name or id. */
export const matchedObject: ReadRecord<string> = ([value = '']) => value || undefined;
