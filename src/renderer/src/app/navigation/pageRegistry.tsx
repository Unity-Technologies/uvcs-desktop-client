import { lazyComponent } from '../../lib/lazyComponent';
import type { Page } from './pages';

// Pages load when first opened so the app starts fast.
const BrowseRepositoryPage = lazyComponent(() => import('../../features/browseRepository/BrowseRepositoryPage').then((module) => module.BrowseRepositoryPage));
const CodeReviewPage = lazyComponent(() => import('../../features/codeReviews/CodeReviewPage').then((module) => module.CodeReviewPage));
const DiffPage = lazyComponent(() => import('../../features/diff/DiffPage').then((module) => module.DiffPage));
const HistoryPage = lazyComponent(() => import('../../features/history/HistoryPage').then((module) => module.HistoryPage));
const MergePage = lazyComponent(() => import('../../features/merge/MergePage').then((module) => module.MergePage));

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

export function pageTitle(page: Page): string {
  switch (page.kind) {
    case 'history':
      return `History of ${fileName(page.path)}`;
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
