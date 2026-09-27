import { Editor } from '@pierre/diffs/edit';
import { EditProvider, File, VirtualizerContext } from '@pierre/diffs/react';
import { useMemo, useState } from 'react';
import { PaneScrollbars } from '../../diff/viewer/PaneScrollbars';
import { highlightedLanguage, syntaxHighlighting } from '../../diff/viewer/syntaxHighlighting';
import { usePierreOptions } from './usePierreOptions';
import { useSurfaceVirtualizer } from './useSurfaceVirtualizer';
import styles from './TextSurface.module.css';
import { diskText, shownText } from '../../../lib/lineBreaks';

interface HandEditorProps {
  path: string;
  /** Where the editing starts: the merged text, conflict markers included. */
  text: string;
  onChange: (text: string) => void;
}

const createEditor: React.ComponentProps<typeof EditProvider>['createEditor'] = (type, options, key) => new Editor(type, options, key);

/**
 * Resolving a conflict by hand: the merged text, free to change. The editor owns the document, so its start stays
 * fixed. It holds the text with lone CRs as LFs; the text it reports keeps the file's own line breaks. Like the
 * whole-file editor of a diff, it renders only the lines in view, and a big text is plain (Pierre highlights an
 * editor on the main thread).
 */
export function HandEditor({ path, text, onChange }: HandEditorProps) {
  const pierreOptions = usePierreOptions();
  const [initialText] = useState(text);
  const highlighting = syntaxHighlighting(initialText, '', true);
  const options = useMemo(() => ({ ...pierreOptions, tokenizeMaxLength: highlighting === 'off' ? 0 : undefined }), [pierreOptions, highlighting]);
  const file = useMemo(() => ({ name: path, lang: highlightedLanguage(highlighting, path), contents: shownText(initialText) }), [path, highlighting, initialText]);
  const { virtualizer, surfaceRef, setSurface } = useSurfaceVirtualizer();

  return (
    <div ref={setSurface} className={styles.surface}>
      <VirtualizerContext.Provider value={virtualizer}>
        <EditProvider createEditor={createEditor}>
          <File file={file} disableWorkerPool options={options} edit onEditChange={(event) => onChange(diskText(event.file.contents, initialText))} />
        </EditProvider>
      </VirtualizerContext.Provider>
      <PaneScrollbars containerRef={surfaceRef} />
    </div>
  );
}
