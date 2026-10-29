/**
 * How screen readers name a comment field's editor: by the label shown above it (`CommentArea`), else by its own
 * name. The editor's text is a contenteditable `<div>`, which `<label htmlFor>` can't name, hence `aria-labelledby`.
 */
export function fieldLabelAttributes(label: string, labelledBy: string | undefined): Record<string, string> {
  return labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': label };
}
