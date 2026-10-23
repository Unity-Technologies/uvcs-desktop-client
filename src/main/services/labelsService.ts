import type { CreateLabelRequest, LabelsApi } from '@shared/api/labels';
import type { Place } from '@shared/domain/place';
import { cmPlace } from '../cm/cmPlace';
import { equalsCondition, findArgs } from '../cm/findQuery';
import { FOUND_LABELS } from '../cm/foundObjects';
import { readRecords } from '../cm/formatRecords';
import { labelCommentArgs } from '../cm/labelCommentArgs';
import { withTempFile } from '../files/tempFile';
import type { ServiceContext } from './ServiceContext';

export function createLabelsService({ cm }: ServiceContext): LabelsApi {
  return {
    async list(place, filter) {
      const at = cmPlace(place);
      const output = await cm.query(findArgs(FOUND_LABELS, filter, 'date desc', [], at.repository), at.options);
      return readRecords(FOUND_LABELS, output);
    },

    async get(place, name) {
      const at = cmPlace(place);
      const output = await cm.query(findArgs(FOUND_LABELS, {}, null, [equalsCondition('name', name)], at.repository), at.options);
      return readRecords(FOUND_LABELS, output).find((label) => label.name === name) ?? null;
    },

    async create(place, request: CreateLabelRequest) {
      const at = cmPlace(place);
      const target = labelTarget(place, request.changesetId);
      await withTempFile(request.comment, async (commentsFile) => {
        await cm.query(['label', 'create', at.spec(`lb:${request.name}`), at.spec(target), `-commentsfile=${commentsFile}`], at.options);
      });
    },

    async rename(place, label, newName) {
      const at = cmPlace(place);
      await cm.query(['label', 'rename', at.spec(`lb:${label}`), newName], at.options);
    },

    // Outside every workspace in both places: `labelCommentArgs` names the repository on every spec.
    editComment(_place, label, comment) {
      return withTempFile(comment, async (commentsFile) => {
        await cm.query(labelCommentArgs(label, comment, commentsFile), { outsideWorkspaces: true });
      });
    },

    async delete(place, labels) {
      const at = cmPlace(place);
      await cm.query(['label', 'delete', ...labels.map((label) => at.spec(`lb:${label}`))], at.options);
    },
  };
}

/** What a new label goes on: the changeset given, or, in a workspace, what it has loaded (its path tells `cm`). */
function labelTarget(place: Place, changesetId: number | undefined): string {
  if (changesetId !== undefined) return `cs:${changesetId}`;
  if (place.kind === 'workspace') return place.workspacePath;
  throw new Error('A repository with no workspace has no loaded changeset to label: name the changeset.');
}
