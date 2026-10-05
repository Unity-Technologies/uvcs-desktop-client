import type { ModelBytes } from '@shared/domain/content';
import { modelSummary, type ModelSummary } from './modelSummary';
import { parseModel, type ModelReadFailure } from './parseModel';
import type { ParsedModel } from './parsedModel';

/** A model file read: parsed and summed up, or why it can't be shown. */
export type ModelFileRead = { kind: 'read'; model: ParsedModel; summary: ModelSummary } | { kind: 'failed'; failure: ModelReadFailure };

/** All a model diff needs of one version, worked out once: in the parsing worker, or on the main thread without it. */
export async function readModelFile(model: ModelBytes): Promise<ModelFileRead> {
  const result = await parseModel(model);
  if (result.kind === 'failed') return result;
  return { kind: 'read', model: result.model, summary: modelSummary(result.model) };
}
