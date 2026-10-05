import { IMAGE_DIFF_MODES, type ImageDiffMode } from '../image/imageDiffModes';

/** How two versions of a model are compared: the image diff's ways of looking, in 3D, so both read as one tool. */
export type ModelDiffMode = ImageDiffMode;

/** The header's mode options, as the image diff's (same words, icons and order). */
export const MODEL_DIFF_MODES = IMAGE_DIFF_MODES;
