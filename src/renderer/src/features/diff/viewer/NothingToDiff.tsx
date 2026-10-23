import { ArchiveX, FileText } from 'lucide-react';
import type { FileContent } from '@shared/domain/content';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { comparisonMethodLabel, type ComparisonMethod } from './comparisonMethod';
import type { DiffBody } from './diffBody';
import { sizeChange, TOO_LARGE_TITLES } from './fileSizeWords';
import { IGNORED_DIFFERENCE_TITLES, ignoredDifference } from './ignoredDifference';
import { OpenFileButton } from './OpenFileButton';

interface NothingToDiffProps {
  /** Why there is no diff to show. */
  reason: Extract<DiffBody, 'emptyFile' | 'noContentChanges' | 'onlyIgnoredChanges' | 'tooLarge' | 'binary' | 'purged'>;
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
          title={TOO_LARGE_TITLES[left.tooLarge ?? right.tooLarge ?? 'text']}
          description={sizeChange(left, right)}
          action={openFile && <OpenFileButton onClick={openFile} />}
        />
      );
    case 'binary':
      return <EmptyState title="Binary file" description={`${sizeChange(left, right)}. Binary contents can't be compared as text.`} />;
    case 'purged':
      return <EmptyState icon={<ArchiveX size={22} />} title="Content purged" description="Both versions were purged from the server." />;
  }
}
