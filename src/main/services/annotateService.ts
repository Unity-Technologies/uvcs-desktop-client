import type { AnnotateApi } from '@shared/api/annotate';
import { ANNOTATE_DATE_FORMAT, ANNOTATE_FORMAT, AnnotationReader } from '../cm/annotation';
import { cmPlace, workspaceOf } from '../cm/cmPlace';
import { toAbsolutePath } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

export function createAnnotateService({ cm }: ServiceContext): AnnotateApi {
  return {
    /** A revision is annotated in any place, by its spec naming its repository; the file as it is, in a workspace. */
    async file(place, path, revisionSpec) {
      const at = cmPlace(place);
      const target = revisionSpec === undefined ? toAbsolutePath(workspaceOf(place, 'Annotating a workspace file'), path) : at.spec(revisionSpec);
      const args = ['annotate', target, `--format=${ANNOTATE_FORMAT}`, `--dateformat=${ANNOTATE_DATE_FORMAT}`];
      const reader = new AnnotationReader();
      return reader.annotation(await cm.queryRecords(args, reader.read, at.options));
    },
  };
}
