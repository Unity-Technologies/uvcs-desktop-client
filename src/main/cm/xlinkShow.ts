import type { XlinkExpansionRule } from '@shared/domain/xlinks';

/**
 * A rule line of `cm xlink --show`, after the xlink's own line and a "Branch expansion rules:" heading:
 * `br:/main/task 1@game@local -> br:/main/x@lib@local [user-defined]`. Each side is a branch spec in its repository
 * (`name@server`, the server itself holding an `@` on Unity Cloud: `lib@acme@cloud`); a branch name holds no `@`. The
 * suffix, localized, marks a rule someone added (`HumanReadableXlinkDataGenerator`); `cm` added the others itself.
 */
const RULE_LINE = /^br:([^@]+)@\S.* -> br:([^@]+)@\S+?( \[[^\]]+\])?$/;

/** The branch expansion rules `cm xlink --show` prints; none for a read-only xlink, which prints only its own line. */
export function parseXlinkRules(output: string): XlinkExpansionRule[] {
  return output.split(/\r?\n/).flatMap((line) => {
    const match = RULE_LINE.exec(line.trim());
    return match ? [{ from: match[1]!, to: match[2]!, userDefined: match[3] !== undefined }] : [];
  });
}
