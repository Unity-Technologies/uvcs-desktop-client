import type { EditorState, TransactionSpec } from '@codemirror/state';
import type { Element, ElementContent, Root } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import { toMdast } from 'hast-util-to-mdast';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown } from 'mdast-util-to-markdown';
import { ownStep } from './ownStep';

/**
 * What a paste from a web page, Slack or a document becomes (docs/features/rich-comments.md, "Pasting"): its
 * formatting written as Markdown, so bold, links and lists survive; code copied from an editor as a code block. Null
 * when the copy holds nothing its plain text doesn't: that pastes as it is, never rewritten.
 *
 * `editorLanguage`: the language a code editor says it copied (VS Code's `vscode-editor-data`), for the fence.
 */
export function markdownFromClipboard(html: string, text: string, editorLanguage?: string): string | null {
  if (!html.trim()) return null;
  if (isCodeFromEditor(html, text)) return codeFence(text, editorLanguage);
  const tree = fromHtml(html, { fragment: true });
  tidy(tree);
  const markdown = toMarkdown(toMdast(tree), {
    extensions: [gfmToMarkdown()],
    bullet: '-',
    emphasis: '*',
    strong: '*',
    fence: '`',
    fences: true,
    rule: '-',
    listItemIndent: 'one',
    // A comment keeps its line breaks as written (`parseMarkdown`'s `comment`): a `<br>` is a plain line end, not `\`.
    handlers: { break: () => '\n' },
  }).trim();
  return sameText(markdown, text) ? null : markdown;
}

/**
 * Code editors (VS Code, Rider, Visual Studio) copy lines as preformatted text in a monospace font. Their own text is
 * the code exactly as written, which the HTML would only escape.
 */
function isCodeFromEditor(html: string, text: string): boolean {
  return text.includes('\n') && /white-space:\s*pre/i.test(html) && /font-family:[^;"]*(?:mono|menlo|consolas|courier|cascadia|jetbrains)/i.test(html);
}

function codeFence(text: string, language: string | undefined): string {
  const code = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  // A fence longer than any run of backticks in the code, so the code can't close it.
  const longest = Math.max(2, ...[...code.matchAll(/`+/g)].map((run) => run[0].length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${language && /^[\w+#-]+$/.test(language) ? language : ''}\n${code}\n${fence}`;
}

/**
 * What a copy's HTML means rather than says: a Google Docs copy is wrapped in a `<b id="docs-internal-guid-…">` that
 * isn't bold, and says bold, italic and struck through with styles on spans; a chip copied from a shown comment
 * names what it was written as (`data-source`); an image pasted inline (`data:`) or from a file is no address to keep.
 */
function tidy(node: Root | Element): void {
  node.children = node.children.flatMap((child) => tidyChild(child as ElementContent));
}

function tidyChild(child: ElementContent): ElementContent[] {
  if (child.type === 'text') return [{ ...child, value: child.value.replace(/ /g, ' ') }];
  if (child.type !== 'element') return [child];
  const source = child.properties['dataSource'];
  if (typeof source === 'string') return [{ type: 'text', value: source }];
  if (child.tagName === 'img' && !/^https?:\/\//i.test(String(child.properties['src'] ?? ''))) return [];
  tidy(child);
  if (child.tagName === 'b' && String(child.properties['id'] ?? '').startsWith('docs-internal-guid')) return child.children;
  return child.tagName === 'span' ? styledSpan(child) : [child];
}

/** A span styled bold, italic or struck through, as the element that says so. */
function styledSpan(span: Element): ElementContent[] {
  const style = String(span.properties['style'] ?? '');
  let children: ElementContent[] = span.children;
  if (/text-decoration[^;]*line-through/i.test(style)) children = [element('del', children)];
  if (/font-style:\s*italic/i.test(style)) children = [element('em', children)];
  if (/font-weight:\s*(?:bold|[6-9]00)/i.test(style)) children = [element('strong', children)];
  return children;
}

function element(tagName: string, children: ElementContent[]): Element {
  return { type: 'element', tagName, properties: {}, children };
}

/**
 * Whether the Markdown says nothing the plain text doesn't: the same words, its escapes (`\_`) and spacing aside.
 */
function sameText(markdown: string, text: string): boolean {
  const unescaped = markdown.replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g, '$1');
  return squeezed(unescaped) === squeezed(text);
}

function squeezed(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Pasting Markdown on the selection: a block (a list, code, a quote, several lines) starts on a line of its own, and
 * what follows it on the line goes on the next. One step to undo.
 */
export function pasteMarkdown(state: EditorState, markdown: string): TransactionSpec {
  const { from, to } = state.selection.main;
  const block = markdown.includes('\n') || /^(?:```|[-*+] |> |\d+[.)] |#{1,6} |\|)/.test(markdown);
  const before = block && state.sliceDoc(state.doc.lineAt(from).from, from).trim() ? '\n' : '';
  const after = block && state.sliceDoc(to, state.doc.lineAt(to).to).trim() ? '\n' : '';
  const insert = before + markdown + after;
  return { changes: { from, to, insert }, selection: { anchor: from + before.length + markdown.length }, scrollIntoView: true, userEvent: 'input.paste', annotations: ownStep };
}
