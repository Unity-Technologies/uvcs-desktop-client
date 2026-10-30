/**
 * How Markdown shows a picture. `chip`: its description as a chip whose picture shows on hover, fetched only then
 * (`CommentImage`: comments, where anyone may link anything). `inline`: the picture itself in the text (`InlinePicture`:
 * release notes, whose pictures are screenshots the app's own releases carry).
 */
export type MarkdownImages = 'chip' | 'inline';

/** Where an inline picture stands: still loading from its host, shown, or failed (gone, blocked, not a picture). */
export type PictureLoad = 'loading' | 'loaded' | 'failed';

/**
 * What an inline picture shows: a quiet placeholder of a stable height while it loads, so the text around it doesn't
 * jump twice; the picture once it has; and the chip when it can't, so its description and its link stay.
 */
export function inlinePictureView(load: PictureLoad): 'placeholder' | 'picture' | 'chip' {
  switch (load) {
    case 'loading':
      return 'placeholder';
    case 'loaded':
      return 'picture';
    case 'failed':
      return 'chip';
  }
}

/** Where a picture stands after the browser says it loaded or failed: a picture of no size failed too (a broken file). */
export function pictureLoadAfter(event: 'load' | 'error', naturalWidth: number): PictureLoad {
  return event === 'load' && naturalWidth > 0 ? 'loaded' : 'failed';
}

/**
 * Whether a click enlarges a picture (`PictureViewer`): only when the text shows it smaller than it is, held to the
 * text's width and a height that keeps a screenshot from filling the dialog (`InlinePicture.module.css`). A picture
 * already at its own size has nothing more to show; a pixel is left for rounding.
 */
export function pictureEnlarges(naturalWidth: number, shownWidth: number): boolean {
  return naturalWidth - shownWidth > 1;
}
