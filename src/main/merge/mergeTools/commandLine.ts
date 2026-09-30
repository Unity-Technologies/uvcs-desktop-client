/** The files and names a merge tool's arguments are filled with, for one conflicting file. */
export interface MergeToolFiles {
  base: string;
  yours: string;
  incoming: string;
  result: string;
  baseName: string;
  yoursName: string;
  incomingName: string;
  fileName: string;
}

const PLACEHOLDER = /\{(base|yours|incoming|result|baseName|yoursName|incomingName|fileName)\}/g;

/** The arguments with every placeholder replaced. Each stays one argument, whatever it holds: no shell sees them. */
export function fillArgs(template: string[], files: MergeToolFiles): string[] {
  return template.map((arg) => arg.replace(PLACEHOLDER, (_match, name: keyof MergeToolFiles) => files[name]));
}
