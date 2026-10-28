import { useMemo, type ReactNode } from 'react';
import { api } from '../api/client';
import { parseMarkdown, type MarkdownBlock, type MarkdownInline, type MarkdownList } from '../lib/markdown';
import { CommentImage } from './comments/CommentImage';
import { copyAsSource } from './comments/copyAsSource';
import { ReferenceChip } from './comments/ReferenceChip';
import styles from './Markdown.module.css';

/** How a text's images show: on hover, as a comment's (the default), or in place, as a merge request's description. */
export type MarkdownImages = 'onHover' | 'inline';

interface MarkdownProps {
  text: string;
  /** A comment: its references show as chips, its line breaks are kept, and copying gives back what was written. */
  comment?: boolean;
  images?: MarkdownImages;
}

/** Markdown text (a comment, release notes, an attribute's value) rendered as elements; web links open in the browser. */
export function Markdown({ text, comment = false, images = 'onHover' }: MarkdownProps) {
  const blocks = useMemo(() => parseMarkdown(text, { comment }), [text, comment]);
  return <MarkdownBlocks blocks={blocks} images={images} copiesSource={comment} />;
}

interface MarkdownBlocksProps {
  blocks: MarkdownBlock[];
  images?: MarkdownImages;
  copiesSource?: boolean;
}

/** Text already read into Markdown's tree (`parseMarkdown`, `releaseNotesFromHtml`), rendered as elements. */
export function MarkdownBlocks({ blocks, images = 'onHover', copiesSource = false }: MarkdownBlocksProps) {
  return (
    <div className={`${styles.markdown} selectable`} onCopy={copiesSource ? copyAsSource : undefined}>
      {renderBlocks(blocks, images)}
    </div>
  );
}

function renderBlocks(blocks: readonly MarkdownBlock[], images: MarkdownImages): ReactNode[] {
  return blocks.map((block, index) => renderBlock(block, index, images));
}

function renderBlock(block: MarkdownBlock, key: number, images: MarkdownImages): ReactNode {
  switch (block.kind) {
    case 'heading': {
      const Heading = `h${block.level + 3}` as 'h4' | 'h5' | 'h6';
      return <Heading key={key}>{renderInlines(block.children, images)}</Heading>;
    }
    case 'paragraph':
      return <p key={key}>{renderInlines(block.children, images)}</p>;
    case 'quote':
      return <blockquote key={key}>{renderBlocks(block.children, images)}</blockquote>;
    case 'code':
      return (
        <pre key={key} data-language={block.language}>
          <code>{block.text}</code>
        </pre>
      );
    case 'list':
      return renderList(block, key, images);
    case 'table':
      return (
        <div key={key} className={styles.table}>
          <table>
            <thead>
              <tr>
                {block.header.map((cell, column) => (
                  <th key={column} style={{ textAlign: block.align[column] ?? undefined }}>
                    {renderInlines(cell, images, true)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, column) => (
                    <td key={column} style={{ textAlign: block.align[column] ?? undefined }}>
                      {renderInlines(cell, images, true)}
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

function renderList(list: MarkdownList, key: number, images: MarkdownImages): ReactNode {
  const List = list.ordered ? 'ol' : 'ul';
  const isTaskList = list.items.some((item) => item.checked !== undefined);
  return (
    <List key={key} start={list.start} className={isTaskList ? styles.taskList : undefined}>
      {list.items.map((item, index) => (
        <li key={index} className={item.checked !== undefined ? styles.task : undefined}>
          {item.checked !== undefined && <input type="checkbox" checked={item.checked} disabled aria-label={item.checked ? 'Done' : 'To do'} />}
          <span>{renderInlines(item.children, images)}</span>
          {item.sublist && renderList(item.sublist, 0, images)}
        </li>
      ))}
    </List>
  );
}

/** `compact`: in a table's cell, chips show without their summary (their tooltip has it), so the columns stay narrow. */
function renderInlines(inlines: readonly MarkdownInline[], images: MarkdownImages, compact = false): ReactNode[] {
  return inlines.map((inline, index) => {
    switch (inline.kind) {
      case 'text':
        return inline.text;
      case 'code':
        return <code key={index}>{inline.text}</code>;
      case 'strong':
        return <strong key={index}>{renderInlines(inline.children, images, compact)}</strong>;
      case 'emphasis':
        return <em key={index}>{renderInlines(inline.children, images, compact)}</em>;
      case 'strike':
        return <del key={index}>{renderInlines(inline.children, images, compact)}</del>;
      case 'break':
        return <br key={index} />;
      case 'link':
        return (
          <MarkdownLink key={index} url={inline.url}>
            {renderInlines(inline.children, images, compact)}
          </MarkdownLink>
        );
      case 'image':
        return <CommentImage key={index} url={inline.url} alt={inline.alt} source={`![${inline.alt}](${inline.url})`} inline={images === 'inline'} />;
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
        if (/^uvcs:/i.test(url)) void import('./comments/openReference').then(({ openAppLink }) => openAppLink(url));
        else void api.system.openExternal(url);
      }}
    >
      {children}
    </a>
  );
}
