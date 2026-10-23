import type { AnnotateApi } from '@shared/api/annotate';
import { ANNOTATE_DATE_FORMAT, ANNOTATE_FORMAT, annotationOf } from '../cm/annotation';
import { cmPlace, workspaceOf } from '../cm/cmPlace';
import { readFields } from '../cm/formatRecords';
import { toAbsolutePath } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

export function createAnnotateService({ cm }: ServiceContext): AnnotateApi {
  return {
    /** A revision is annotated in any place, by its spec naming its repository; the file as it is, in a workspace. */
    async file(place, path, revisionSpec) {
      const at = cmPlace(place);
      const target = revisionSpec === undefined ? toAbsolutePath(workspaceOf(place, 'Annotating a workspace file'), path) : at.spec(revisionSpec);
      const args = ['annotate', target, `--format=${ANNOTATE_FORMAT}`, `--dateformat=${ANNOTATE_DATE_FORMAT}`];
      return annotationOf(await cm.queryRecords(args, readFields, at.options));
    },
  };
}
