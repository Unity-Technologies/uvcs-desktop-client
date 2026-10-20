import type { Annotation } from '@shared/domain/annotate';

/** What the annotation pane shows under its toolbar: why it couldn't annotate, a spinner while it does, or the code. */
export type AnnotationBody = 'failed' | 'annotating' | 'code';

export function annotationBodyOf(annotation: Annotation | undefined, failed: boolean): AnnotationBody {
  if (failed) return 'failed';
  return annotation ? 'code' : 'annotating';
}
