import type { MergeTool } from '@shared/domain/mergeTools';

/** Why the arguments can't be saved: without `{result}` the tool would save the merge nowhere the app reads. */
export function mergeToolArgsProblem(args: readonly string[]): string | undefined {
  return args.some((arg) => arg.includes('{result}')) ? undefined : 'Include {result}: the file the tool saves the merge to.';
}

/** A known tool whose arguments the user changed, so it can go back to its own. */
export function hasOwnArgsToGoBackTo(tool: MergeTool): boolean {
  return tool.origin !== 'custom' && tool.args.join('\0') !== tool.defaultArgs.join('\0');
}
