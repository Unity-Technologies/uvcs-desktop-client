import { Virtualizer } from '@pierre/diffs';
import { useCallback, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { hotkey } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { fileNameOf } from '../../lib/text';
import { displayName } from '../../lib/userName';
import { AnnotationGutter } from './AnnotationGutter';
import { AnnotationRules } from './AnnotationRules';
import type { AnnotateColumns } from './annotateOptionsStore';
import { blocksInView, highlightedChangeset, walkedBlock, type AnnotationBlock } from './annotationBlocks';
import { ANNOTATION_LINE_HEIGHT, CODE_PADDING_TOP, lineAtTop, scrollTopRevealing } from './annotationLayout';
import { BlockCard } from './BlockCard';
import { HighlightedCode } from './HighlightedCode';
import type { BlockLinks } from './blockLinks';
import { useBlockCard } from './useBlockCard';
import { useVisibleRows } from './useVisibleRows';
import styles from './AnnotatedCode.module.css';

interface AnnotatedCodeProps {
  code: string;
  path: string;
  blocks: readonly AnnotationBlock[];
  lineCount: number;
  columns: AnnotateColumns;
  links: BlockLinks;
}

/**
 * Highlighted code (Pierre) with the annotation gutter beside it and the blocks' rules over both. All three live in one
 * scroll container and share a pinned line height (`annotationLayout`), so they scroll together without any syncing
 * code. Files can be huge: everything renders only the lines in view, and the code is highlighted as a read-only diff
 * would be (`syntaxHighlighting`: on the main thread, in Pierre's workers after showing as plain text, or not at all).
 * The keyboard walks the blocks (⌥↓ ⌥↑, with ⇧ those of the same changeset), Enter shows the block's revision and
 * Space its card.
 */
export function AnnotatedCode({ code, path, blocks, lineCount, columns, links }: AnnotatedCodeProps) {
  const [virtualizer] = useState(() => new Virtualizer());
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const attachScroller = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) virtualizer.setup(element);
      else virtualizer.cleanUp();
      setScroller(element);
    },
    [virtualizer],
  );
  const shown = blocksInView(blocks, useVisibleRows(scroller, lineCount, ANNOTATION_LINE_HEIGHT, CODE_PADDING_TOP));
  // The block picked by a click or the keyboard (-1 for none); hovering picks nothing.
  const [picked, setPicked] = useState(-1);
  const cardState = useBlockCard(scroller);
  const highlighted = useMemo(() => highlightedChangeset(blocks, picked), [blocks, picked]);

  const showRevision = (index: number): void => {
    const block = blocks[index];
    if (!block) return;
    if (links.selectsInHistory) links.showInHistory(block.changeset.changesetId);
    else cardState.toggle(index);
  };
  const walk = (direction: 1 | -1, sameChangeset = false): void => {
    if (!scroller) return;
    const index = walkedBlock(blocks, picked, direction, sameChangeset, lineAtTop(scroller.scrollTop));
    if (index === null) return;
    cardState.card.close();
    setPicked(index);
    const scrollTop = scrollTopRevealing(blocks[index]!, { scrollTop: scroller.scrollTop, height: scroller.clientHeight });
    if (scrollTop !== null) scroller.scrollTop = scrollTop;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== event.currentTarget) return;
    const handlers: [string, () => void][] = [
      // Before Esc leaves the pane: only while something is picked.
      ...(picked !== -1 ? ([[hotkey('annotateLetGo'), () => setPicked(-1)]] as [string, () => void][]) : []),
      [hotkey('annotateNextBlock'), () => walk(1)],
      [hotkey('annotatePreviousBlock'), () => walk(-1)],
      [hotkey('annotateNextSameChangeset'), () => walk(1, true)],
      [hotkey('annotatePreviousSameChangeset'), () => walk(-1, true)],
      [hotkey('annotateShowRevision'), () => showRevision(picked)],
      [hotkey('annotateBlockDetails'), () => picked !== -1 && cardState.toggle(picked)],
    ];
    const handler = handlers.find(([shortcut]) => matchesShortcut(event.nativeEvent, shortcut));
    if (!handler) return;
    event.preventDefault();
    handler[1]();
  };

  const pickedBlock = blocks[picked];

  return (
    <div
      ref={attachScroller}
      className={styles.scroller}
      style={{ '--diffs-line-height': `${ANNOTATION_LINE_HEIGHT}px`, '--diffs-gap-block': `${CODE_PADDING_TOP}px` } as CSSProperties}
      tabIndex={0}
      role="region"
      aria-label={`Annotated lines of ${fileNameOf(path)}`}
      onKeyDown={onKeyDown}
    >
      <div className={styles.columns}>
        <AnnotationGutter
          blocks={blocks}
          shown={shown}
          columns={columns}
          lineHeight={ANNOTATION_LINE_HEIGHT}
          picked={picked}
          onPick={(index) => setPicked(index === picked ? -1 : index)}
          onHoverLabel={cardState.hover}
          onPinCard={(index) => {
            setPicked(index);
            cardState.toggle(index);
          }}
          onShowRevision={(index) => {
            setPicked(index);
            links.showInHistory(blocks[index]!.changeset.changesetId);
          }}
          revisionTip={links.selectsInHistory ? 'Select this revision' : 'Show this revision in history'}
          walkBack={links.walkBack}
        />
        <HighlightedCode className={styles.code} code={code} path={path} virtualizer={virtualizer} />
        <AnnotationRules blocks={blocks} shown={shown} lineHeight={ANNOTATION_LINE_HEIGHT} highlighted={highlighted} />
      </div>
      <BlockCard blocks={blocks} cardState={cardState} picked={picked} scroller={scroller} links={links} />
      <span className="visually-hidden" aria-live="polite">
        {pickedBlock &&
          `Lines ${pickedBlock.start + 1} to ${pickedBlock.end}: changeset ${pickedBlock.changeset.changesetId} by ${displayName(pickedBlock.changeset.owner)}`}
      </span>
    </div>
  );
}
