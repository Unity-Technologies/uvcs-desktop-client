import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

/** Editor chrome driven by the app's CSS variables, so it follows light and dark themes automatically. */
const chrome = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: '12px',
  },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-tertiary)',
    border: 'none',
  },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--bg-selected-strong) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-changedLine': { backgroundColor: 'var(--diff-added-bg) !important' },
  '.cm-deletedChunk, .cm-merge-a .cm-changedLine': { backgroundColor: 'var(--diff-removed-bg) !important' },
  '.cm-changedText': { background: 'var(--diff-added-strong) !important' },
  '.cm-merge-a .cm-changedText, .cm-deletedChunk .cm-deletedText': { background: 'var(--diff-removed-strong) !important' },
  '.cm-merge-b .cm-changedText': { background: 'var(--diff-added-strong) !important' },
  '.cm-changeGutter': { width: '3px', paddingLeft: '0' },
  '.cm-merge-a .cm-changedLineGutter': { background: 'var(--status-deleted)' },
  '.cm-merge-b .cm-changedLineGutter, .cm-changedLineGutter': { background: 'var(--status-added)' },
  '.cm-collapsedLines': {
    padding: '4px 12px',
    background: 'var(--bg-hover)',
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--font-ui)',
    fontSize: '11px',
    cursor: 'pointer',
  },
  '.cm-collapsedLines:hover': { color: 'var(--text-primary)' },
  '.cm-mergeSpacer': { backgroundColor: 'var(--bg-hover)' },
});

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword], color: 'light-dark(#8a3ffc, #c792ea)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'light-dark(#1a7f37, #a5d6a7)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'light-dark(#b35900, #f78c6c)' },
  { tag: [tags.comment, tags.meta], color: 'var(--text-tertiary)', fontStyle: 'italic' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'light-dark(#0b69c7, #82aaff)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'light-dark(#6639ba, #dcbdfb)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'light-dark(#0550ae, #9cdcfe)' },
  { tag: [tags.tagName], color: 'light-dark(#116329, #7ee787)' },
  { tag: [tags.heading], fontWeight: '600' },
]);

export const editorTheme = [chrome, syntaxHighlighting(highlight)];
