import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FilterRuleList } from '@shared/domain/pendingChanges';

/** The workspace's own rules file of each list, at its root. */
const FILTER_RULE_FILES: Record<FilterRuleList, string> = {
  ignore: 'ignore.conf',
  cloaked: 'cloaked.conf',
  hidden: 'hidden_changes.conf',
};

/** Appends a rule to the workspace's rules file of `list`, creating the file when there is none. */
export async function addFilterRule(workspacePath: string, list: FilterRuleList, pattern: string): Promise<void> {
  const rulesFile = join(workspacePath, FILTER_RULE_FILES[list]);
  const current = await readFile(rulesFile, 'utf8').catch(() => '');
  await writeFile(rulesFile, withRule(current, pattern), 'utf8');
}

/** A rules file (`ignore.conf`, `cloaked.conf`, `hidden_changes.conf`) with one more rule at its end, in its own line breaks. */
export function withRule(rules: string, pattern: string): string {
  const eol = rules.includes('\r\n') ? '\r\n' : '\n';
  const separator = rules === '' || rules.endsWith('\n') ? '' : eol;
  return `${rules}${separator}${pattern}${eol}`;
}
