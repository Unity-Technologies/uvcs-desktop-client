import { EyeOff, FileText } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { comparisonMethodLabel, type ComparisonMethod } from './comparisonMethod';
import { DiffNotice } from './DiffNotice';
import { IGNORED_DIFFERENCE_TITLES, ignoredDifference } from './ignoredDifference';
import type { WholeFileNote } from './wholeFileNote';

interface WholeFileNoticeProps {
  note: WholeFileNote;
  /** Why both versions are the same, e.g. "Moved without content changes". */
  identicalDescription: string;
  /** The original text and the modified one as it is now: the `ignored` note says what they differ in. */
  texts: { original: string; current: string };
  comparisonMethod: ComparisonMethod;
  onRecognizeAll: () => void;
}

/** The line above a file typed into whole, saying why there is no diff (`wholeFileNote`). */
export function WholeFileNotice({ note, identicalDescription, texts, comparisonMethod, onRecognizeAll }: WholeFileNoticeProps) {
  switch (note) {
    case 'empty':
      return <DiffNotice tone="info" icon={<FileText size={13} />}>Empty file. Type to add to it.</DiffNotice>;
    case 'identical':
      return (
        <DiffNotice tone="info" icon={<FileText size={13} />}>
          No content changes. {identicalDescription}
        </DiffNotice>
      );
    case 'unsaved':
      return <DiffNotice tone="info" icon={<FileText size={13} />}>Your edits show as a diff once saved.</DiffNotice>;
    case 'ignored':
      return (
        <DiffNotice tone="info" icon={<EyeOff size={13} />} action={<Button size="small" onClick={onRecognizeAll}>Recognize all</Button>}>
          {IGNORED_DIFFERENCE_TITLES[ignoredDifference(texts.original, texts.current)]}. The comparison method, {comparisonMethodLabel(comparisonMethod)}, hides these changes.
        </DiffNotice>
      );
  }
}
