import { fileNameOf } from '../../lib/text';
import type { Page } from './pages';

/** What a page's own data adds to its name: a review page's review is a merge request (`usePageTitle` reads it). */
export interface PageTitleContext {
  mergeRequest?: boolean;
}

/** A page's name, in the breadcrumb and a page window's title. A review is a code review until known otherwise. */
export function pageTitle(page: Page, { mergeRequest = false }: PageTitleContext = {}): string {
  switch (page.kind) {
    case 'history':
      return `History of ${fileNameOf(page.path)}`;
    case 'diff':
      return page.title;
    case 'merge':
      return 'Merge';
    case 'codeReview':
      return `${mergeRequest ? 'Merge request' : 'Code review'} ${page.reviewId}`;
    case 'browseRepository':
      return `Changeset ${page.changesetId}`;
  }
}
