import type { Annotation } from '@shared/domain/annotate';

/**
 * What the annotation pane shows under its toolbar: why it couldn't annotate, a spinner while it does, that the file
 * is empty (it has no line to annotate), or the code.
 */
export type AnnotationBody = 'failed' | 'annotating' | 'emptyFile' | 'code';

export function annotationBodyOf(annotation: Annotation | undefined, failed: boolean): AnnotationBody {
  if (failed) return 'failed';
  if (!annotation) return 'annotating';
  return annotation.lines.length === 0 ? 'emptyFile' : 'code';
}
