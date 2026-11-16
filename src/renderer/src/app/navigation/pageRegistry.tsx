import { BrowseRepositoryPage } from '../../features/browseRepository/BrowseRepositoryPage';
import { CodeReviewPage } from '../../features/codeReviews/CodeReviewPage';
import { DiffPage } from '../../features/diff/DiffPage';
import { HistoryPage } from '../../features/history/HistoryPage';
import { MergePage } from '../../features/merge/MergePage';
import type { Page } from './pages';

// Pages are in the startup bundle, as views are (`viewRegistry`): each one's first frame is its own layout. What is
// heavy beneath them loads on first use (`startupBundle.test.ts`).

export function PageContent({ page }: { page: Page }) {
  switch (page.kind) {
    case 'history':
      return <HistoryPage page={page} />;
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
