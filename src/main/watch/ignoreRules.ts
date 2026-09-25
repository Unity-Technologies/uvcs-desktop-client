/**
 * The simple rules of an `ignore.conf`: an item name (`Library`) or a rooted path (`/Build/Output`), without
 * wildcards. Enough to skip the heavy folders editors and build tools churn (Unity's `Library/`, `Temp/`, `obj/`),
 * which would otherwise run `cm status` for changes it never shows. A rule that a `!` exception mentions is left
 * out, since part of what it ignores may be shown again. Controlled items matching a rule are missed; rare enough.
 */
export interface IgnoreRules {
  /** Ignored wherever they appear. */
  names: ReadonlySet<string>;
  /** Workspace-relative, `/`-separated. */
  rootedPaths: readonly string[];
}

export const NO_IGNORE_RULES: IgnoreRules = { names: new Set(), rootedPaths: [] };

export function parseIgnoreRules(ignoreConf: string): IgnoreRules {
  const lines = ignoreConf
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const exceptions = lines.filter((line) => line.startsWith('!')).map((line) => line.slice(1));
  const rules = lines
    .filter((line) => !line.startsWith('!') && !/[*?[\]]/.test(line))
    .map((line) => line.replace(/\/+$/, ''))
    .filter((rule) => rule.replace(/^\//, '') && !exceptions.some((exception) => exception.includes(rule.replace(/^\//, ''))));

  return {
    names: new Set(rules.filter((rule) => !rule.includes('/'))),
    rootedPaths: rules.filter((rule) => rule.startsWith('/')).map((rule) => rule.slice(1)),
  };
}

/** Whether a workspace-relative, `/`-separated path is ignored or inside an ignored directory. */
export function isIgnored(relativePath: string, rules: IgnoreRules): boolean {
  if (relativePath.split('/').some((segment) => rules.names.has(segment))) return true;
  return rules.rootedPaths.some((rooted) => relativePath === rooted || relativePath.startsWith(`${rooted}/`));
}
