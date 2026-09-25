import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Columns2, FoldVertical, Rows2 } from 'lucide-react';
import { useCallback, useRef, type ReactNode } from 'react';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { formatSize } from '../../../lib/formatDate';
import { useShortcut } from '../../../lib/useShortcut';
import { EmptyState } from '../../../ui/EmptyState';
import { IconButton } from '../../../ui/IconButton';
import { CenteredSpinner } from '../../../ui/Spinner';
import { useDiffPreferences } from './diffPreferencesStore';
import { ImageDiff } from './ImageDiff';
import { TextDiff, type DiffNavigator } from './TextDiff';
import styles from './FileDiffViewer.module.css';

interface FileDiffViewerProps {
  workspacePath: string;
  original: ContentSource;
  modified: ContentSource;
  /** Used for syntax highlighting and to recognize images. */
  fileName: string;
  /** Shown at the left of the toolbar, e.g. the file path and its status. */
  title?: ReactNode;
  /** Explains why both versions are identical, e.g. "Moved without content changes". */
  identicalDescription?: string;
}

/** Compares two versions of a file, choosing a text, image or binary presentation. */
export function FileDiffViewer({ workspacePath, original, modified, fileName, title, identicalDescription }: FileDiffViewerProps) {
  const { layout, collapseUnchanged, setLayout, setCollapseUnchanged } = useDiffPreferences();
  const navigator = useRef<DiffNavigator | null>(null);
  const originalContent = useContent(workspacePath, original);
  const modifiedContent = useContent(workspacePath, modified);

  const onNavigatorReady = useCallback((ready: DiffNavigator) => {
    navigator.current = ready;
  }, []);
  useShortcut('alt+down', () => navigator.current?.next());
  useShortcut('alt+up', () => navigator.current?.previous());

  const error = originalContent.error ?? modifiedContent.error;
  const left = originalContent.data;
  const right = modifiedContent.data;
  const isText = left && right && !left.isBinary && !right.isBinary;

  return (
    <div className={styles.viewer}>
      <div className={styles.toolbar}>
        <div className={styles.title}>{title}</div>
        {isText && (
          <>
            <IconButton size="small" icon={<ChevronUp size={14} />} label="Previous change" shortcut="alt+up" onClick={() => navigator.current?.previous()} />
            <IconButton size="small" icon={<ChevronDown size={14} />} label="Next change" shortcut="alt+down" onClick={() => navigator.current?.next()} />
            <IconButton
              size="small"
              icon={<FoldVertical size={14} />}
              label={collapseUnchanged ? 'Show all lines' : 'Collapse unchanged lines'}
              variant={collapseUnchanged ? 'secondary' : 'ghost'}
              onClick={() => setCollapseUnchanged(!collapseUnchanged)}
            />
            <IconButton
              size="small"
              icon={layout === 'split' ? <Rows2 size={14} /> : <Columns2 size={14} />}
              label={layout === 'split' ? 'Unified view' : 'Side-by-side view'}
              onClick={() => setLayout(layout === 'split' ? 'unified' : 'split')}
            />
          </>
        )}
      </div>

      {error ? (
        <EmptyState title="Couldn't load this file" description={error.message} />
      ) : !left || !right ? (
        <CenteredSpinner />
      ) : isText ? (
        left.text === right.text ? (
          <EmptyState title="No content changes" description={identicalDescription ?? 'The contents of both versions are identical.'} />
        ) : (
          <TextDiff
            original={left.text ?? ''}
            modified={right.text ?? ''}
            fileName={fileName}
            layout={layout}
            collapseUnchanged={collapseUnchanged}
            onNavigatorReady={onNavigatorReady}
          />
        )
      ) : left.imageDataUrl || right.imageDataUrl ? (
        <ImageDiff originalUrl={left.imageDataUrl} modifiedUrl={right.imageDataUrl} />
      ) : (
        <BinarySummary original={left} modified={right} />
      )}
    </div>
  );
}

function useContent(workspacePath: string, source: ContentSource) {
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'content', source),
    queryFn: () => api.content.read(workspacePath, source),
    staleTime: source.kind === 'workspaceFile' ? 0 : Infinity,
  });
}

function BinarySummary({ original, modified }: { original: FileContent; modified: FileContent }) {
  return (
    <EmptyState
      title="Binary file"
      description={`${formatSize(original.size)} → ${formatSize(modified.size)}. Binary contents can't be compared as text.`}
    />
  );
}
