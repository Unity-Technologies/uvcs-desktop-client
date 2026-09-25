import type { CreateLabelRequest, LabelsApi } from '@shared/api/labels';
import { findArgs } from '../cm/findQuery';
import { findRecords, toLabel } from '../cm/findObjects';
import { labelCommentArgs } from '../cm/labelCommentArgs';
import { withTempFile } from '../files/tempFile';
import type { ServiceContext } from './ServiceContext';

export function createLabelsService({ cm }: ServiceContext): LabelsApi {
  return {
    async list(workspacePath, filter) {
      const xml = await cm.query(findArgs('label', filter, 'date desc'), { cwd: workspacePath });
      return findRecords(xml, 'MARKER').map(toLabel);
    },

    create(workspacePath, request: CreateLabelRequest) {
      const target = request.changesetId === undefined ? workspacePath : `cs:${request.changesetId}`;
      return withTempFile(request.comment, async (commentsFile) => {
        await cm.query(['label', 'create', `lb:${request.name}`, target, `-commentsfile=${commentsFile}`], { cwd: workspacePath });
      });
    },

    async rename(workspacePath, label, newName) {
      await cm.query(['label', 'rename', `lb:${label}`, newName], { cwd: workspacePath });
    },

    editComment(_workspacePath, label, comment) {
      return withTempFile(comment, async (commentsFile) => {
        await cm.query(labelCommentArgs(label, comment, commentsFile));
      });
    },

    async delete(workspacePath, labels) {
      await cm.query(['label', 'delete', ...labels.map((label) => `lb:${label}`)], { cwd: workspacePath });
    },
  };
}
