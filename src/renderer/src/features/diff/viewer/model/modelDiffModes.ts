import { IMAGE_DIFF_MODES, type ImageDiffMode, type ImageModeDefinition } from '../image/imageDiffModes';

/** How two versions of a model are compared: the image diff's ways of looking, in 3D, so both read as one tool. */
export type ModelDiffMode = Exclude<ImageDiffMode, 'differences'>;

/** The header's mode options, as the image diff's (same words, icons and order). */
export const MODEL_DIFF_MODES = IMAGE_DIFF_MODES.filter((mode): mode is ImageModeDefinition & { value: ModelDiffMode } => mode.value !== 'differences');
