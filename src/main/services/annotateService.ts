import type { AnnotateApi } from '@shared/api/annotate';
import { ANNOTATE_DATE_FORMAT, ANNOTATE_FORMAT, parseAnnotation } from '../cm/annotation';
import { toAbsolutePath } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

export function createAnnotateService({ cm }: ServiceContext): AnnotateApi {
  return {
    async file(workspacePath, path, revisionSpec) {
      const target = revisionSpec ?? toAbsolutePath(workspacePath, path);
      const output = await cm.query(['annotate', target, `--format=${ANNOTATE_FORMAT}`, `--dateformat=${ANNOTATE_DATE_FORMAT}`], {
        cwd: workspacePath,
      });
      return parseAnnotation(output);
    },
  };
}
