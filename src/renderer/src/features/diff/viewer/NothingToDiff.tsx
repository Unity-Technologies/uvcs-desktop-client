import { AppWindow, FileText } from 'lucide-react';
import type { FileContent } from '@shared/domain/content';
import { formatSize } from '../../../lib/formatDate';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { comparisonMethodLabel, type ComparisonMethod } from './comparisonMethod';
import type { DiffBody } from './diffBody';
import { IGNORED_DIFFERENCE_TITLES, ignoredDifference } from './ignoredDifference';

interface NothingToDiffProps {
  /** Why there is no diff to show. */
  reason: Extract<DiffBody, 'emptyFile' | 'noContentChanges' | 'onlyIgnoredChanges' | 'tooLarge' | 'binary'>;
  left: FileContent;
  right: FileContent;
  /** Why both versions are the same, e.g. "Moved without content changes". */
  identicalDescription: string;
  comparisonMethod: ComparisonMethod;
  onRecognizeAll: () => void;
  /** Opens a workspace file too large to show in the app it opens with. */
  openFile?: () => void;
}

/** What shows in place of a diff that has nothing to show (`diffBodyOf`), and what the user can do about it. */
export function NothingToDiff({ reason, left, right, identicalDescription, comparisonMethod, onRecognizeAll, openFile }: NothingToDiffProps) {
  switch (reason) {
    case 'emptyFile':
      return <EmptyState icon={<FileText size={22} />} title="Empty file" description="This file has no content." />;
    case 'noContentChanges':
      return <EmptyState title="No content changes" description={identicalDescription} />;
    case 'onlyIgnoredChanges':
      return (
        <EmptyState
          title={IGNORED_DIFFERENCE_TITLES[ignoredDifference(left.text ?? '', right.text ?? '')]}
          description={`The comparison method, ${comparisonMethodLabel(comparisonMethod)}, hides these changes.`}
          action={<Button onClick={onRecognizeAll}>Recognize all</Button>}
        />
      );
    case 'tooLarge':
      return (
        <EmptyState
          title={(left.tooLarge ?? right.tooLarge) === 'image' ? 'This image is too large to preview' : 'This file is too large to show a diff'}
          description={sizeChange(left, right)}
          action={openFile && <Button icon={<AppWindow size={13} />} onClick={openFile}>Open file</Button>}
        />
      );
    case 'binary':
      return <EmptyState title="Binary file" description={`${sizeChange(left, right)}. Binary contents can't be compared as text.`} />;
  }
}

function sizeChange(left: FileContent, right: FileContent): string {
  return `${formatSize(left.size)} → ${formatSize(right.size)}`;
}
