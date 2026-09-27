import type { DetailsWidthLimits } from '../../components/detailsWidthStore';

/**
 * A file tree keeps its width and the selected file's diff takes the rest: a diff needs the room more than names. On a
 * narrow window the tree gives way first, so the diff keeps room for two columns of code.
 */
export const FILE_TREE_WIDTH: DetailsWidthLimits = { initial: 400, min: 240, max: 800, restMin: 480 };
