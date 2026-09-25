import type { Label } from '@shared/domain/label';

/**
 * `cm` has no command to edit a label's comment, but `cm label create` on an existing label replaces its comment
 * before applying it again (here to the changeset it already labels, which changes nothing else). Specs carry the
 * repository so it runs outside any workspace: inside one with pending changes, `cm` refuses to apply a label.
 * An empty comment leaves the old one (and would launch PLASTICEDITOR), so a comment can't be emptied.
 */
export function labelCommentArgs(label: Pick<Label, 'name' | 'changeset' | 'repository'>, comment: string, commentsFile: string): string[] {
  if (!comment.trim()) throw new Error("cm can't remove a label's comment, only replace it.");
  return ['label', 'create', `lb:${label.name}@${label.repository}`, `cs:${label.changeset}@${label.repository}`, `-commentsfile=${commentsFile}`];
}
