import { useQuery } from '@tanstack/react-query';
import { Columns2, FoldVertical, Pencil, Rows2, WrapText } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { formatSize } from '../../../lib/formatDate';
import { useShortcut } from '../../../lib/useShortcut';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { IconButton } from '../../../ui/IconButton';
import { CenteredSpinner } from '../../../ui/Spinner';
import { useDiffPreferences } from './diffPreferencesStore';
import { ImageDiff } from './ImageDiff';
import { lazyComponent } from '../../../lib/lazyComponent';
import { useFileEditing } from './useFileEditing';
import styles from './FileDiffViewer.module.css';

// The diff renderer (Pierre + Shiki) is large; load it with the first diff instead of at startup.
const TextDiff = lazyComponent(() => import('./TextDiff').then((module) => module.TextDiff));

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

/**
 * Compares two versions of a file, choosing a text, image or binary presentation.
 * When the modified side is a file in the workspace, it can be edited in place.
 */
export function FileDiffViewer({ workspacePath, original, modified, fileName, title, identicalDescription }: FileDiffViewerProps) {
  const { layout, collapseUnchanged, wrapLines, setLayout, setCollapseUnchanged, setWrapLines } = useDiffPreferences();
  const originalContent = useContent(workspacePath, original);
  const modifiedContent = useContent(workspacePath, modified);
  const editablePath = modified.kind === 'workspaceFile' ? modified.path : null;
  const editing = useFileEditing(workspacePath, editablePath);

  const error = originalContent.error ?? modifiedContent.error;
  const left = originalContent.data;
  const right = modifiedContent.data;
  const isText = Boolean(left && right && !left.isBinary && !right.isBinary);
  const canEdit = isText && editablePath !== null;

  useShortcut('mod+s', () => void editing.save(), editing.editing);
  useShortcut('mod+e', editing.start, canEdit && !editing.editing);

  return (
    <div className={styles.viewer}>
      <div className={styles.toolbar}>
        <div className={styles.title}>{title}</div>
        {editing.editing ? (
          <>
            <Button size="small" variant="ghost" onClick={editing.discard}>
              {editing.dirty ? 'Discard edits' : 'Done'}
            </Button>
            <Button size="small" variant="primary" disabled={!editing.dirty} onClick={() => void editing.save()}>
              Save
            </Button>
          </>
        ) : (
          isText && (
            <>
              {canEdit && <IconButton size="small" icon={<Pencil size={13} />} label="Edit this file" shortcut="mod+e" onClick={editing.start} />}
              <IconButton
                size="small"
                icon={<FoldVertical size={14} />}
                label={collapseUnchanged ? 'Show all lines' : 'Collapse unchanged lines'}
                variant={collapseUnchanged ? 'secondary' : 'ghost'}
                onClick={() => setCollapseUnchanged(!collapseUnchanged)}
              />
              <IconButton
                size="small"
                icon={<WrapText size={14} />}
                label={wrapLines ? "Don't wrap lines" : 'Wrap lines'}
                variant={wrapLines ? 'secondary' : 'ghost'}
                onClick={() => setWrapLines(!wrapLines)}
              />
              <IconButton
                size="small"
                icon={layout === 'split' ? <Rows2 size={14} /> : <Columns2 size={14} />}
                label={layout === 'split' ? 'Unified view' : 'Side-by-side view'}
                onClick={() => setLayout(layout === 'split' ? 'unified' : 'split')}
              />
            </>
          )
        )}
      </div>

      {error ? (
        <EmptyState title="Couldn't load this file" description={error.message} />
      ) : !left || !right ? (
        <CenteredSpinner />
      ) : isText ? (
        left.text === right.text && !editing.editing ? (
          <EmptyState
            title="No content changes"
            description={identicalDescription ?? 'The contents of both versions are identical.'}
            action={canEdit && <Button icon={<Pencil size={13} />} onClick={editing.start}>Edit file</Button>}
          />
        ) : (
          <Suspense fallback={<CenteredSpinner />}>
            <TextDiff original={left.text ?? ''} modified={right.text ?? ''} fileName={fileName} editing={editing.editing} onEdit={editing.change} />
          </Suspense>
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
