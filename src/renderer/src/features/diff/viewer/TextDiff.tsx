import { goToNextChunk, goToPreviousChunk, MergeView, unifiedMergeView } from '@codemirror/merge';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';
import { editorTheme } from './codeMirrorTheme';
import type { DiffLayout } from './diffPreferencesStore';
import { loadLanguageForFile } from './languageForFile';
import styles from './TextDiff.module.css';

interface TextDiffProps {
  original: string;
  modified: string;
  fileName: string;
  layout: DiffLayout;
  collapseUnchanged: boolean;
  /** Receives the controls to jump between changes each time the editor is (re)created. */
  onNavigatorReady?: (navigator: DiffNavigator) => void;
}

export interface DiffNavigator {
  next: () => void;
  previous: () => void;
}

const COLLAPSE = { margin: 3, minSize: 6 };

/** Read-only text diff with syntax highlighting, side by side or unified. */
export function TextDiff({ original, modified, fileName, layout, collapseUnchanged, onNavigatorReady }: TextDiffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const language = useLanguage(fileName);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent || language === undefined) return;

    const extensions: Extension[] = [
      lineNumbers(),
      editorTheme,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      ...(language ? [language] : []),
    ];
    const collapse = collapseUnchanged ? COLLAPSE : undefined;

    if (layout === 'split') {
      const view = new MergeView({
        a: { doc: original, extensions },
        b: { doc: modified, extensions },
        parent,
        collapseUnchanged: collapse,
        gutter: true,
      });
      onNavigatorReady?.(navigatorFor(view.b));
      return () => view.destroy();
    }

    const view = new EditorView({
      parent,
      doc: modified,
      extensions: [...extensions, unifiedMergeView({ original, collapseUnchanged: collapse, mergeControls: false, gutter: true })],
    });
    onNavigatorReady?.(navigatorFor(view));
    return () => view.destroy();
  }, [original, modified, layout, collapseUnchanged, language, onNavigatorReady]);

  return <div ref={containerRef} className={styles.diff} />;
}

function navigatorFor(view: EditorView): DiffNavigator {
  return {
    next: () => goToNextChunk(view),
    previous: () => goToPreviousChunk(view),
  };
}

/** `undefined` while loading, `null` when the file type has no highlighting. */
function useLanguage(fileName: string): Extension | null | undefined {
  const [language, setLanguage] = useState<Extension | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLanguage(undefined);
    loadLanguageForFile(fileName)
      .then((loaded) => !cancelled && setLanguage(loaded))
      .catch(() => !cancelled && setLanguage(null));
    return () => {
      cancelled = true;
    };
  }, [fileName]);

  return language;
}
