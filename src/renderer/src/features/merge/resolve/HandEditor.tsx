import type { Editor } from '@pierre/diffs/edit';
import { EditProvider, File, VirtualizerContext } from '@pierre/diffs/react';
import { useMemo, useRef, useState } from 'react';
import { ActionContextMenu } from '../../../ui/menu/ActionContextMenu';
import { PaneScrollbars } from '../../diff/viewer/PaneScrollbars';
import { createAppEditor, type CreateEditor } from '../../diff/viewer/appEditor';
import { scrollToLine } from '../../diff/viewer/lineScroll';
import { highlightedLanguage, syntaxHighlighting } from '../../diff/viewer/syntaxHighlighting';
import { useCodeMenu } from '../../diff/viewer/useCodeMenu';
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

/** A merge's hand-editing shows one side, the newer one, always typed into. */
const ONE_TYPED_TEXT = { onlySide: 'additions' as const, typedInto: true };

/**
 * Resolving a conflict by hand: the merged text, free to change. The editor owns the document, so its start stays
 * fixed. It holds the text with lone CRs as LFs; the text it reports keeps the file's own line breaks. Like the
 * whole-file editor of a diff, it renders only the lines in view, and a big text is plain (Pierre highlights an
 * editor on the main thread). Its right-click menu is the code's (`useCodeMenu`): the editor's history, Find and
 * Replace, Go to line, Compare with clipboard, the clipboard and Select all.
 */
export function HandEditor({ path, text, onChange }: HandEditorProps) {
  const [initialText] = useState(text);
  const pierreOptions = usePierreOptions(initialText);
  const highlighting = syntaxHighlighting(initialText, '', true);
  const options = useMemo(() => ({ ...pierreOptions, tokenizeMaxLength: highlighting === 'off' ? 0 : undefined }), [pierreOptions, highlighting]);
  const file = useMemo(() => ({ name: path, lang: highlightedLanguage(highlighting, path), contents: shownText(initialText) }), [path, highlighting, initialText]);
  const { virtualizer, surfaceRef, setSurface } = useSurfaceVirtualizer();
  const editor = useRef<Editor | null>(null);
  const [createEditor] = useState(() => {
    const create: CreateEditor = (type, options, key) => {
      const created = createAppEditor(type, options, key);
      editor.current = created as unknown as Editor;
      return created;
    };
    return create;
  });
  const codeMenu = useCodeMenu({
    containerRef: surfaceRef,
    scrollTo: (element, line) => scrollToLine(element, line, virtualizer),
    fileName: path,
    textOf: () => editor.current?.getText() ?? shownText(initialText),
    sides: ONE_TYPED_TEXT,
    editor,
  });

  return (
    <ActionContextMenu entries={codeMenu.entries} onContextMenu={codeMenu.onContextMenu}>
      <div ref={setSurface} className={styles.surface} onKeyDown={codeMenu.onKeyDown}>
        <VirtualizerContext.Provider value={virtualizer}>
          <EditProvider createEditor={createEditor}>
            <File file={file} disableWorkerPool options={options} edit onEditChange={(event) => onChange(diskText(event.file.contents, initialText))} />
          </EditProvider>
        </VirtualizerContext.Provider>
        <PaneScrollbars containerRef={surfaceRef} />
      </div>
    </ActionContextMenu>
  );
}
