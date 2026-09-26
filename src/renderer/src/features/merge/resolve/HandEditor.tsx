import { Editor } from '@pierre/diffs/edit';
import { EditProvider, File } from '@pierre/diffs/react';
import { useMemo, useRef, useState } from 'react';
import { PaneScrollbars } from '../../diff/viewer/PaneScrollbars';
import { usePierreOptions } from './usePierreOptions';
import styles from './TextSurface.module.css';
import { diskText, shownText } from '../../../lib/lineBreaks';
import { syntaxLanguage } from '../../../lib/syntaxLanguage';

interface HandEditorProps {
  path: string;
  /** Where the editing starts: the merged text, conflict markers included. */
  text: string;
  onChange: (text: string) => void;
}

const createEditor: React.ComponentProps<typeof EditProvider>['createEditor'] = (type, options, key) => new Editor(type, options, key);

/**
 * Resolving a conflict by hand: the merged text, free to change. The editor owns the document, so its start stays
 * fixed. It holds the text with lone CRs as LFs; the text it reports keeps the file's own line breaks.
 */
export function HandEditor({ path, text, onChange }: HandEditorProps) {
  const options = usePierreOptions();
  const [initialText] = useState(text);
  const file = useMemo(() => ({ name: path, lang: syntaxLanguage(path), contents: shownText(initialText) }), [path, initialText]);
  const surface = useRef<HTMLDivElement>(null);

  return (
    <div ref={surface} className={styles.surface}>
      <EditProvider createEditor={createEditor}>
        <File file={file} disableWorkerPool options={options} edit onEditChange={(event) => onChange(diskText(event.file.contents, initialText))} />
      </EditProvider>
      <PaneScrollbars containerRef={surface} />
    </div>
  );
}
