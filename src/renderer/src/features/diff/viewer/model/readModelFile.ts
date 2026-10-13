import type { ModelBytes } from '@shared/domain/content';
import { DEFAULT_IMPORT_SETTINGS, importScaleOf, type ImportSettingsSource, type ModelImportSettings } from './modelImportSettings';
import { modelSummary, type ModelSummary } from './modelSummary';
import { parseModel, type ModelReadFailure } from './parseModel';
import type { ParsedModel } from './parsedModel';

/** A model file read: parsed and summed up, or why it can't be shown. */
export type ModelFileRead = { kind: 'read'; model: ParsedModel; summary: ModelSummary } | { kind: 'failed'; failure: ModelReadFailure };

/** What a version is read with: the files it needs beside it (`gltfCompanions`), and its import settings (its `.meta`). */
export interface ModelReadOptions {
  companions: Readonly<Record<string, Uint8Array>>;
  settings: ModelImportSettings;
  /** Where `settings` came from: the Materials look takes the workspace's for a version without a `.meta` of its own. */
  settingsFrom: ImportSettingsSource;
}

export const PLAIN_READ: ModelReadOptions = { companions: {}, settings: DEFAULT_IMPORT_SETTINGS, settingsFrom: 'none' };

/**
 * All a model diff needs of one version, worked out once: in the model worker, or on the main thread without it. The
 * import settings scale it as Unity does, which takes the file's own units: known once it is parsed.
 */
export async function readModelFile(model: ModelBytes, { companions, settings }: ModelReadOptions = PLAIN_READ): Promise<ModelFileRead> {
  const result = await parseModel(model, companions);
  if (result.kind === 'failed') return result;
  const parsed = { ...result.model, importScale: importScaleOf(settings, result.model.unitScale) };
  return { kind: 'read', model: parsed, summary: modelSummary(parsed) };
}
