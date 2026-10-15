// A model's `.meta` shown as what it does: the model beside it, read under each version's import settings, so a
// change made in the import settings alone (the Scale Factor raised instead of a re-export, a clip split moved) reads
// in Unity's terms ("100× larger in Unity", "Clip Wave ends past its take"). The `.meta`'s text is a click away.

import { useQueries } from '@tanstack/react-query';
import { useContext, useEffect, useMemo } from 'react';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { queryKeys } from '../../../../api/queryKeys';
import { EmptyState } from '../../../../ui/EmptyState';
import { CenteredSpinner } from '../../../../ui/Spinner';
import { contentQuery } from '../contentQueries';
import { ModelDiffViewer } from './ModelDiffViewer';
import type { ModelDiffMode } from './modelDiffModes';
import { readImportSettings } from './modelImportSettings';
import { metaModelView, modelBesideMeta, modelOfMeta, modelReadsOfSides, type MetaModelRead } from './modelMeta';
import { SiblingFinderContext, sourcePathOf, type DiffSide } from './modelSiblings';

interface ModelMetaDiffProps {
  workspacePath: string;
  /** Where each version of the `.meta` was read from: the model is read beside it. */
  sources: { original: ContentSource; modified: ContentSource };
  /** Each version of the `.meta`'s text (with unsaved edits, for the one typed into). */
  texts: { original: string | null; modified: string | null };
  mode: ModelDiffMode;
  /** Neither side has its model beside it (in History, a `.meta` moved since): the `.meta` shows as its text instead. */
  onModelAbsent: () => void;
}

const EMPTY: FileContent = { text: '', isBinary: false, size: 0 };

/** A side without a model: built apart from the component, as `contentQuery` is, so its query keeps nothing of it. */
function noContentQuery(workspacePath: string) {
  return { queryKey: queryKeys.inWorkspace(workspacePath, 'content', null), queryFn: () => Promise.resolve(EMPTY) };
}

export function ModelMetaDiff({ workspacePath, sources, texts, mode, onModelAbsent }: ModelMetaDiffProps) {
  const findSibling = useContext(SiblingFinderContext);
  // Each side's model is beside that side's `.meta`; a side without one (added, deleted) has no model to show.
  const modelSources = modelBesideMeta(findSibling, sources) ?? { original: null, modified: null };
  const modelName = sourcePathOf(sources.modified) ?? sourcePathOf(sources.original) ?? '';
  // A `.meta` changed alone has the same model on both sides: read once, shown on both.
  const { reads: modelReads, readOf } = modelReadsOfSides(modelSources);
  const reads = useQueries({
    queries: modelReads.map((source) => ({ ...(source ? contentQuery(workspacePath, source) : noContentQuery(workspacePath)), retry: false })),
  });
  const settings = useMemo(
    () => ({ original: readImportSettings(texts.original ?? ''), modified: readImportSettings(texts.modified ?? '') }),
    [texts.original, texts.modified],
  );
  const original = reads[readOf.original]?.data;
  const modified = reads[readOf.modified]?.data;
  const readOfSide = (side: DiffSide): MetaModelRead => {
    const read = reads[readOf[side]];
    if (!modelSources[side]) return 'none';
    if (read?.isError) return 'failed';
    if (!read?.data) return 'loading';
    // A model too large to show is still there: the model view says so.
    return read.data.model || read.data.tooLarge === 'model' ? 'model' : 'absent';
  };
  const view = metaModelView({ original: readOfSide('original'), modified: readOfSide('modified') });
  useEffect(() => {
    if (view === 'text') onModelAbsent();
  }, [view, onModelAbsent]);
  // A model that isn't beside its `.meta` reads as absent, never as a failure: this is the server or the disk failing.
  if (view === 'failed') {
    return <EmptyState title={`Couldn't read ${modelOfMeta(modelName)?.split(/[\\/]/).pop() ?? 'the model'}`} description="The .meta's own text is in Code." />;
  }
  if (view !== 'model' || !original || !modified) return <CenteredSpinner />;
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
