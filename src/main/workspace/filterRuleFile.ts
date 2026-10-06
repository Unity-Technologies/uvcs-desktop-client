import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FilterRuleList } from '@shared/domain/pendingChanges';

/** The workspace's own rules file of each list, at its root. */
const FILTER_RULE_FILES: Record<FilterRuleList, string> = {
  ignore: 'ignore.conf',
  cloaked: 'cloaked.conf',
  hidden: 'hidden_changes.conf',
};

/** Appends rules to the workspace's rules file of `list`, creating the file when there is none. */
export async function addFilterRules(workspacePath: string, list: FilterRuleList, patterns: string[]): Promise<void> {
  const rulesFile = join(workspacePath, FILTER_RULE_FILES[list]);
  const current = await readFile(rulesFile, 'utf8').catch(() => '');
  await writeFile(rulesFile, withRules(current, patterns), 'utf8');
}

/**
 * A rules file (`ignore.conf`, `cloaked.conf`, `hidden_changes.conf`) with the rules it doesn't hold yet at its end, one
 * per line, in its own line breaks.
 */
export function withRules(rules: string, patterns: string[]): string {
  const eol = rules.includes('\r\n') ? '\r\n' : '\n';
  const present = new Set(rules.split(/\r?\n/));
  const added = [...new Set(patterns)].filter((pattern) => !present.has(pattern));
  if (added.length === 0) return rules;
  const separator = rules === '' || rules.endsWith('\n') ? '' : eol;
  return `${rules}${separator}${added.map((pattern) => `${pattern}${eol}`).join('')}`;
}
