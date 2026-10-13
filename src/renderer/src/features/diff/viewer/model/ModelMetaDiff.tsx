// A model's `.meta` shown as what it does: the model beside it, read under each version's import settings, so a
// change made in the import settings alone (the Scale Factor raised instead of a re-export, a clip split moved) reads
// in Unity's terms ("100× larger in Unity", "Clip Wave ends past its take"). The `.meta`'s text is a click away.

import { useQueries } from '@tanstack/react-query';
import { useContext, useMemo } from 'react';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { api } from '../../../../api/client';
import { queryKeys } from '../../../../api/queryKeys';
import { EmptyState } from '../../../../ui/EmptyState';
import { CenteredSpinner } from '../../../../ui/Spinner';
import { contentCaching } from '../useDiffContents';
import { ModelDiffViewer } from './ModelDiffViewer';
import type { ModelDiffMode } from './modelDiffModes';
import { readImportSettings } from './modelImportSettings';
import { modelBesideMeta, modelOfMeta, modelReadsOfSides } from './modelMeta';
import { SiblingFinderContext, sourcePathOf } from './modelSiblings';

interface ModelMetaDiffProps {
  workspacePath: string;
  /** Where each version of the `.meta` was read from: the model is read beside it. */
  sources: { original: ContentSource; modified: ContentSource };
  /** Each version of the `.meta`'s text (with unsaved edits, for the one typed into). */
  texts: { original: string | null; modified: string | null };
  mode: ModelDiffMode;
}

const EMPTY: FileContent = { text: '', isBinary: false, size: 0 };

export function ModelMetaDiff({ workspacePath, sources, texts, mode }: ModelMetaDiffProps) {
  const findSibling = useContext(SiblingFinderContext);
  // Each side's model is beside that side's `.meta`; a side without one (added, deleted) has no model to show.
  const modelSources = modelBesideMeta(findSibling, sources) ?? { original: null, modified: null };
  const modelName = sourcePathOf(sources.modified) ?? sourcePathOf(sources.original) ?? '';
  // A `.meta` changed alone has the same model on both sides: read once, shown on both.
  const { reads: modelReads, readOf } = modelReadsOfSides(modelSources);
  const reads = useQueries({
    queries: modelReads.map((source) => ({
      queryKey: queryKeys.inWorkspace(workspacePath, 'content', source),
      queryFn: () => (source ? api.content.read(workspacePath, source) : Promise.resolve(EMPTY)),
      retry: false,
      ...(source ? contentCaching([source]) : {}),
    })),
  });
  const settings = useMemo(
    () => ({ original: readImportSettings(texts.original ?? ''), modified: readImportSettings(texts.modified ?? '') }),
    [texts.original, texts.modified],
  );
  const original = reads[readOf.original]?.data;
  const modified = reads[readOf.modified]?.data;
  if (reads.some((read) => read.isError)) {
    return <EmptyState title={`Couldn't read ${modelOfMeta(modelName)?.split(/[\\/]/).pop() ?? 'the model'}`} description="The model this .meta belongs to isn't where the .meta is." />;
  }
  if (!original || !modified) return <CenteredSpinner />;
  return (
    <ModelDiffViewer
      workspacePath={workspacePath}
      sources={{ original: modelSources.original ?? { kind: 'empty' }, modified: modelSources.modified ?? { kind: 'empty' } }}
      original={original}
      modified={modified}
      mode={mode}
      settings={settings}
    />
  );
}
