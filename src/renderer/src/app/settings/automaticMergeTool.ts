/** What "Automatic" picks, in its tooltip: the rule, which the line under it shouldn't repeat. */
export const AUTOMATIC_MERGE_TOOL_RULE = "The UVCS merge tool when it's installed, else the first one found";

/** The line under "Automatic": the tool it picks now ("Uses Visual Studio Code"), or the rule while none is found. */
export function automaticMergeToolDescription(pickedName: string | undefined): string {
  return pickedName ? `Uses ${pickedName}` : AUTOMATIC_MERGE_TOOL_RULE;
}
