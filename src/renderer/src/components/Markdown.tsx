import { useMemo, type ReactNode } from 'react';
import { api } from '../api/client';
import { parseMarkdown, type MarkdownBlock, type MarkdownInline } from '../lib/markdown';
import styles from './Markdown.module.css';

/** Markdown text such as release notes, rendered as elements; links open in the browser. */
export function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return <MarkdownBlocks blocks={blocks} />;
}

/** Text already read into Markdown's tree (`parseMarkdown`, `releaseNotesFromHtml`), rendered as elements. */
export function MarkdownBlocks({ blocks }: { blocks: MarkdownBlock[] }) {
  return <div className={`${styles.markdown} selectable`}>{blocks.map(renderBlock)}</div>;
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  switch (block.kind) {
    case 'heading': {
      const Heading = `h${block.level + 3}` as 'h4' | 'h5' | 'h6';
      return <Heading key={index}>{renderInlines(block.children)}</Heading>;
    }
    case 'paragraph':
      return <p key={index}>{renderInlines(block.children)}</p>;
    case 'quote':
      return <blockquote key={index}>{renderInlines(block.children)}</blockquote>;
    case 'code':
      return <pre key={index}>{block.text}</pre>;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlines(item)}</li>
          ))}
        </List>
      );
    }
  }
}

function renderInlines(inlines: MarkdownInline[]): ReactNode[] {
  return inlines.map((inline, index) => {
    switch (inline.kind) {
      case 'text':
        return inline.text;
      case 'code':
        return <code key={index}>{inline.text}</code>;
      case 'strong':
        return <strong key={index}>{renderInlines(inline.children)}</strong>;
      case 'emphasis':
        return <em key={index}>{renderInlines(inline.children)}</em>;
      case 'link':
        return (
          <ExternalLink key={index} url={inline.url}>
            {renderInlines(inline.children)}
          </ExternalLink>
        );
    }
  });
}

/** A link that opens in the default browser instead of inside the app. */
function ExternalLink({ url, children }: { url: string; children: ReactNode }) {
  return (
    <a
      className={styles.link}
      href={url}
      data-tip={url}
      onClick={(event) => {
        event.preventDefault();
        void api.system.openExternal(url);
      }}
    >
      {children}
    </a>
  );
}
