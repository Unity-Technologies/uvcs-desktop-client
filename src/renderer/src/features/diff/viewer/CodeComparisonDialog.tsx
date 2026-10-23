import { File, FileDiff } from '@pierre/diffs/react';
import { useMemo, useRef } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { syntaxLanguage } from '../../../lib/syntaxLanguage';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { comparisonSubtitle, type CodeComparison } from './codeComparison';
import { useDiffPreferences } from './diffPreferencesStore';
import type { LineDiff } from './lineDiff';
import { PaneScrollbars } from './PaneScrollbars';
import { pierreDiffOptions, pierreFileOptions } from './pierreOptions';
import styles from './CodeComparisonDialog.module.css';

interface ComparedCode {
  title: string;
  /** What the two pieces are; the note of pieces that show as one follows it (`comparisonSubtitle`). */
  description: string;
  comparison: CodeComparison;
  /** Names the language the code is highlighted in. */
  fileName: string;
}

/**
 * Two pieces of code side by side (`codeComparison`), as "Compare moved code" shows what moved with what it became.
 * Read-only, in the diff's own look and layout; Pierre numbers the lines from the start of each piece, so the title
 * says where they are.
 */
export function openCodeComparisonDialog(compared: ComparedCode): void {
  openDialog((close) => <CodeComparisonDialog {...compared} onClose={close} />);
}

function CodeComparisonDialog({ title, description, comparison, fileName, onClose }: ComparedCode & { onClose: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      title={title}
      description={comparisonSubtitle(description, comparison)}
      width={1100}
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div ref={scroller} className={styles.diff}>
        {comparison.kind === 'unchanged' ? <UnchangedCode code={comparison.code} fileName={fileName} /> : <DiffedCode diff={comparison.diff} />}
        <PaneScrollbars containerRef={scroller} />
      </div>
    </Dialog>
  );
}

function DiffedCode({ diff }: { diff: LineDiff }) {
  const theme = useResolvedTheme();
  const { layout, wrapLines } = useDiffPreferences();
  const options = useMemo(
    () => ({ ...pierreDiffOptions({ theme, layout, collapseUnchanged: false, wrapLines }), parseDiffOptions: diff.options }),
    [theme, layout, wrapLines, diff.options],
  );
  return <FileDiff fileDiff={diff.meta} options={options} />;
}

function UnchangedCode({ code, fileName }: { code: string; fileName: string }) {
  const theme = useResolvedTheme();
  const { wrapLines } = useDiffPreferences();
  const file = useMemo(() => ({ name: fileName, lang: syntaxLanguage(fileName), contents: code }), [code, fileName]);
  const options = useMemo(() => pierreFileOptions({ theme, wrapLines }), [theme, wrapLines]);
  return <File file={file} options={options} />;
}
