import { AnnotatePage } from '../../features/annotate/AnnotatePage';
import { BrowseRepositoryPage } from '../../features/browseRepository/BrowseRepositoryPage';
import { CodeReviewPage } from '../../features/codeReviews/CodeReviewPage';
import { DiffPage } from '../../features/diff/DiffPage';
import { HistoryPage } from '../../features/history/HistoryPage';
import { MergePage } from '../../features/merge/MergePage';
import type { Page } from './pages';

export function PageContent({ page }: { page: Page }) {
  switch (page.kind) {
    case 'history':
      return <HistoryPage page={page} />;
    case 'annotate':
      return <AnnotatePage page={page} />;
    case 'diff':
      return <DiffPage page={page} />;
    case 'merge':
      return <MergePage page={page} />;
    case 'codeReview':
      return <CodeReviewPage page={page} />;
    case 'browseRepository':
      return <BrowseRepositoryPage page={page} />;
  }
}

export function pageTitle(page: Page): string {
  switch (page.kind) {
    case 'history':
      return `History of ${fileName(page.path)}`;
    case 'annotate':
      return `Annotate ${fileName(page.path)}`;
    case 'diff':
      return page.title;
    case 'merge':
      return 'Merge';
    case 'codeReview':
      return `Code review ${page.reviewId}`;
    case 'browseRepository':
      return `Changeset ${page.changesetId}`;
  }
}

function fileName(path: string): string {
  return path.split('/').at(-1) ?? path;
}
