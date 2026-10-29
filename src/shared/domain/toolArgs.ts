import { spec } from './specs';
import { TOOL_PLACEHOLDERS, type ToolPlaceholder, type ToolSubject } from './tools';

/** A subject ready to run on: a revision is a file by then, saved to a temp file. */
export type ResolvedSubject = Exclude<ToolSubject, { kind: 'revision' }>;

/** What a subject's placeholders read: `repository` when the subject doesn't say, `workspacePath` null with none. */
export interface ToolContext {
  repository: string | undefined;
  workspacePath: string | null;
}

/** Each placeholder's value for one subject; empty where it names nothing of it (`{label}` of a branch). */
export function placeholderValues(subject: ResolvedSubject, context: ToolContext): Record<ToolPlaceholder, string> {
  const common = { '{repository}': subject.repository ?? context.repository ?? '', '{workspace}': context.workspacePath ?? '' };
  const none = { '{path}': '', '{changeset}': '', '{branch}': '', '{label}': '' };
  switch (subject.kind) {
    case 'item':
      return { ...common, ...none, '{object}': subject.path, '{path}': subject.path };
    case 'changeset':
      return { ...common, ...none, '{object}': spec.changeset(subject.id), '{changeset}': String(subject.id), '{branch}': subject.branch ?? '' };
    case 'branch':
      return { ...common, ...none, '{object}': spec.branch(subject.name), '{branch}': subject.name };
    case 'label':
      return { ...common, ...none, '{object}': spec.label(subject.name), '{label}': subject.name };
  }
}

const PLACEHOLDER = new RegExp(Object.keys(TOOL_PLACEHOLDERS).map((name) => name.replace(/[{}]/g, '\\$&')).join('|'), 'g');

/**
 * The arguments with every placeholder filled in, each still one argument: a path with spaces needs no quotes, and
 * nothing in a value is read again (a `{label}` named `{path}` stays so). Unknown `{words}` stay as typed.
 */
export function toolArgs(args: readonly string[], values: Record<ToolPlaceholder, string>): string[] {
  return args.map((arg) => arg.replace(PLACEHOLDER, (name) => values[name as ToolPlaceholder]));
}
