import { useMemo, type ReactNode } from 'react';
import { api } from '../api/client';
import { parseMarkdown, type MarkdownBlock, type MarkdownInline, type MarkdownList } from '../lib/markdown';
import { CodeBlock } from './comments/CodeBlock';
import { CommentImage } from './comments/CommentImage';
import { copyAsSource } from './comments/copyAsSource';
import { ReferenceChip } from './comments/ReferenceChip';
import styles from './Markdown.module.css';

interface MarkdownProps {
  text: string;
  /** A comment: its references show as chips, its line breaks are kept, and copying gives back what was written. */
  comment?: boolean;
}

/** Markdown text (a comment, release notes, an attribute's value) rendered as elements; web links open in the browser. */
export function Markdown({ text, comment = false }: MarkdownProps) {
  const blocks = useMemo(() => parseMarkdown(text, { comment }), [text, comment]);
  return <MarkdownBlocks blocks={blocks} copiesSource={comment} />;
}

interface MarkdownBlocksProps {
  blocks: MarkdownBlock[];
  copiesSource?: boolean;
}

/** Text already read into Markdown's tree (`parseMarkdown`, `releaseNotesFromHtml`), rendered as elements. */
export function MarkdownBlocks({ blocks, copiesSource = false }: MarkdownBlocksProps) {
  return (
    <div className={`${styles.markdown} selectable`} onCopy={copiesSource ? copyAsSource : undefined}>
      {renderBlocks(blocks)}
    </div>
  );
}

function renderBlocks(blocks: readonly MarkdownBlock[]): ReactNode[] {
  return blocks.map((block, index) => renderBlock(block, index));
}

function renderBlock(block: MarkdownBlock, key: number): ReactNode {
  switch (block.kind) {
    case 'heading': {
      const Heading = `h${block.level + 3}` as 'h4' | 'h5' | 'h6';
      return <Heading key={key}>{renderInlines(block.children)}</Heading>;
    }
    case 'paragraph':
      return <p key={key}>{renderInlines(block.children)}</p>;
    case 'quote':
      return <blockquote key={key}>{renderBlocks(block.children)}</blockquote>;
    case 'code':
      return (
        <CodeBlock key={key} text={block.text} language={block.language} />
      );
    case 'list':
      return renderList(block, key);
    case 'table':
      return (
        <div key={key} className={styles.table}>
          <table>
            <thead>
              <tr>
                {block.header.map((cell, column) => (
                  <th key={column} style={{ textAlign: block.align[column] ?? undefined }}>
                    {renderInlines(cell, true)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, column) => (
                    <td key={column} style={{ textAlign: block.align[column] ?? undefined }}>
                      {renderInlines(cell, true)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'rule':
      return <hr key={key} />;
  }
}

function renderList(list: MarkdownList, key: number): ReactNode {
  const List = list.ordered ? 'ol' : 'ul';
  const isTaskList = list.items.some((item) => item.checked !== undefined);
  return (
    <List key={key} start={list.start} className={isTaskList ? styles.taskList : undefined}>
      {list.items.map((item, index) => (
        <li key={index} className={item.checked !== undefined ? styles.task : undefined}>
          {item.checked !== undefined && <input type="checkbox" checked={item.checked} disabled aria-label={item.checked ? 'Done' : 'To do'} />}
          <span>{renderInlines(item.children)}</span>
          {item.sublist && renderList(item.sublist, 0)}
        </li>
      ))}
    </List>
  );
}

/** `compact`: in a table's cell, chips show without their summary (their tooltip has it), so the columns stay narrow. */
function renderInlines(inlines: readonly MarkdownInline[], compact = false): ReactNode[] {
  return inlines.map((inline, index) => {
    switch (inline.kind) {
      case 'text':
        return inline.text;
      case 'code':
        return <code key={index}>{inline.text}</code>;
      case 'strong':
        return <strong key={index}>{renderInlines(inline.children, compact)}</strong>;
      case 'emphasis':
        return <em key={index}>{renderInlines(inline.children, compact)}</em>;
      case 'strike':
        return <del key={index}>{renderInlines(inline.children, compact)}</del>;
      case 'break':
        return <br key={index} />;
      case 'link':
        return (
          <MarkdownLink key={index} url={inline.url}>
            {renderInlines(inline.children, compact)}
          </MarkdownLink>
        );
      case 'image':
        return <CommentImage key={index} url={inline.url} alt={inline.alt} source={`![${inline.alt}](${inline.url})`} />;
      case 'reference':
        return <ReferenceChip key={index} reference={inline.reference} source={inline.source} compact={compact} />;
    }
  });
}

/** A web or mail link opens outside the app; the app's own links (`uvcs://`) open in it, as a pasted one does. */
function MarkdownLink({ url, children }: { url: string; children: ReactNode }) {
  return (
    <a
      className={styles.link}
      href={url}
      data-tip={url}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        // Loaded on the first click: opening a link reaches the windows, the navigation and the queries.
        if (/^uvcs:/i.test(url)) void import('../app/links/openLink').then(({ openLink }) => openLink(url));
        else void api.system.openExternal(url);
      }}
    >
      {children}
    </a>
  );
}
