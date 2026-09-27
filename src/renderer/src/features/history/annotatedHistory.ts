import type { PageOf } from '../../app/navigation/pages';

/**
 * What "Annotate" opens outside the Files view: the file's history with a revision annotated, the one `select` names
 * or else the workspace's.
 */
export function annotatedHistory(request: Omit<PageOf<'history'>, 'kind' | 'view'>): PageOf<'history'> {
  return { ...request, kind: 'history', view: 'annotate' };
}
