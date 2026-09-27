import { Virtualizer } from '@pierre/diffs';
import { File, VirtualizerContext, WorkerPoolContext } from '@pierre/diffs/react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { ItemRevision } from '@shared/domain/history';
import { useResolvedTheme } from '../../app/settings/useResolvedTheme';
import { hotkey } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { fileNameOf } from '../../lib/text';
import { useHoverCard } from '../../lib/useHoverCard';
import { displayName } from '../../lib/userName';
import { highlightWorkers } from '../diff/viewer/highlightWorkers';
import { PIERRE_SURFACE_CSS, pierreThemeName } from '../diff/viewer/pierreOptions';
import { highlightedLanguage, syntaxHighlighting } from '../diff/viewer/syntaxHighlighting';
import { AnnotationCard } from './AnnotationCard';
import { AnnotationGutter, BLOCK_LABEL_ATTRIBUTE } from './AnnotationGutter';
import { AnnotationRules } from './AnnotationRules';
import type { AnnotateColumns } from './annotateOptionsStore';
import { adjacentBlock, blockAt, blocksInView, type AnnotationBlock } from './annotationBlocks';
import { useVisibleRows } from './useVisibleRows';
import styles from './AnnotatedCode.module.css';

/**
 * Pierre's line height and top padding, pinned so the gutter can lay out its rows with the same geometry.
 * The gutter reads the padding from the shared `--diffs-gap-block` variable.
 */
const ANNOTATION_LINE_HEIGHT = 20;
const CODE_PADDING_TOP = 8;

/** What a block leads to. */
export interface BlockLinks {
  openChangeset: (changesetId: number) => void;
  /** The changeset's revision in the file's history: selected beside it, or opened there. */
  showInHistory: (changesetId: number) => void;
  /** Where the annotation sits beside the history list, clicking a block (or Enter) selects its revision there. */
  selectsInHistory: boolean;
  /** Beside the history list: "Annotate before this change", to the revision before it (if the history has one). */
  walkBack?: {
    revisionBefore: (changesetId: number) => ItemRevision | undefined;
    annotateBefore: (revision: ItemRevision) => void;
  };
}

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
 * scroll container and share a pinned line height, so they scroll together without any syncing code. Files can be
 * huge: everything renders only the lines in view, and the code is highlighted as a read-only diff would be
 * (`syntaxHighlighting`: on the main thread, in Pierre's workers after showing as plain text, or not at all).
 * The keyboard walks the blocks (⌥↓ ⌥↑, with ⇧ those of the same changeset), Enter shows the block's revision and
 * Space its card.
 */
export function AnnotatedCode({ code, path, blocks, lineCount, columns, links }: AnnotatedCodeProps) {
  const theme = useResolvedTheme();
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
  const range = useVisibleRows(scroller, lineCount, ANNOTATION_LINE_HEIGHT, CODE_PADDING_TOP);
  const shown = blocksInView(blocks, range);
  const [hovered, setHovered] = useState<number | null>(null);
  const [active, setActive] = useState(-1);
  const [cardBlock, setCardBlock] = useState(-1);
  const card = useHoverCard();
  const highlighted = blocks[hovered ?? active]?.changeset.changesetId ?? null;

  const highlighting = syntaxHighlighting(code, '', false);
  const workers = highlighting === 'background' ? highlightWorkers() : undefined;
  const file = useMemo(() => ({ name: fileNameOf(path), lang: highlightedLanguage(highlighting, path), contents: code }), [path, code, highlighting]);
  const options = useMemo(
    () => ({
      theme: pierreThemeName(theme),
      themeType: theme,
      overflow: 'scroll' as const,
      disableFileHeader: true,
      unsafeCSS: PIERRE_SURFACE_CSS,
      tokenizeMaxLength: highlighting === 'off' ? 0 : undefined,
    }),
    [theme, highlighting],
  );

  // A card follows its label only while nothing scrolls under it.
  useEffect(() => {
    if (!scroller || !card.open) return;
    const close = (): void => card.close();
    scroller.addEventListener('scroll', close, { passive: true, once: true });
    return () => scroller.removeEventListener('scroll', close);
  }, [scroller, card.open]);

  const labelOf = useCallback(
    (): Element | null => scroller?.querySelector(`[${BLOCK_LABEL_ATTRIBUTE}="${cardBlock}"]`) ?? null,
    [scroller, cardBlock],
  );
  const revisionBefore = links.walkBack?.revisionBefore;
  const cardChangeset = blocks[cardBlock]?.changeset;

  const showBlock = (index: number): void => {
    const block = blocks[index];
    if (!block) return;
    if (links.selectsInHistory) links.showInHistory(block.changeset.changesetId);
    else openCard(index);
  };
  const openCard = (index: number): void => {
    setCardBlock(index);
    card.toggle();
  };
  const moveTo = (index: number | null): void => {
    if (index === null || !scroller) return;
    card.close();
    setActive(index);
    const top = CODE_PADDING_TOP + blocks[index]!.start * ANNOTATION_LINE_HEIGHT;
    const bottom = top + ANNOTATION_LINE_HEIGHT;
    // A block out of view comes in a few lines from the top, with what came before it for context.
    if (top < scroller.scrollTop || bottom > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = top - 3 * ANNOTATION_LINE_HEIGHT;
  };
  // From the keyboard's block; the first key picks the block at the top of the view.
  const step = (direction: 1 | -1, sameChangeset = false): void => {
    if (active !== -1) return moveTo(adjacentBlock(blocks, active, direction, sameChangeset));
    if (scroller && blocks.length > 0) moveTo(blockAt(blocks, Math.floor(Math.max(0, scroller.scrollTop - CODE_PADDING_TOP) / ANNOTATION_LINE_HEIGHT)));
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== event.currentTarget) return;
    const handlers: [string, () => void][] = [
      [hotkey('annotateNextBlock'), () => step(1)],
      [hotkey('annotatePreviousBlock'), () => step(-1)],
      [hotkey('annotateNextSameChangeset'), () => step(1, true)],
      [hotkey('annotatePreviousSameChangeset'), () => step(-1, true)],
      [hotkey('annotateShowRevision'), () => showBlock(active)],
      [hotkey('annotateBlockDetails'), () => active !== -1 && openCard(active)],
    ];
    const handler = handlers.find(([shortcut]) => matchesShortcut(event.nativeEvent, shortcut));
    if (!handler) return;
    event.preventDefault();
    handler[1]();
  };

  const activeBlock = blocks[active];

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
          highlighted={highlighted}
          active={active}
          onHover={setHovered}
          onHoverLabel={(index) => {
            if (index === null) return card.hoverProps.onMouseLeave();
            if (!card.pinned) setCardBlock(index);
            card.hoverProps.onMouseEnter();
          }}
          onClick={(index) => {
            setActive(index);
            showBlock(index);
          }}
          walkBack={links.walkBack}
        />
        <VirtualizerContext.Provider value={virtualizer}>
          <WorkerPoolContext.Provider value={workers}>
            <File key={theme} className={styles.code} file={file} options={options} disableWorkerPool={!workers} />
          </WorkerPoolContext.Provider>
        </VirtualizerContext.Provider>
        <AnnotationRules blocks={blocks} shown={shown} lineHeight={ANNOTATION_LINE_HEIGHT} highlighted={highlighted} />
      </div>
      <AnnotationCard
        changeset={cardChangeset}
        anchor={labelOf}
        open={card.open}
        pinned={card.pinned}
        onOpenChange={card.onOpenChange}
        hoverProps={card.hoverProps}
        returnFocusTo={scroller}
        actions={{
          openChangeset: (changesetId) => {
            card.close();
            links.openChangeset(changesetId);
          },
          revisionBefore: cardChangeset && revisionBefore?.(cardChangeset.changesetId),
          annotateBefore: (revision) => {
            card.close();
            links.walkBack?.annotateBefore(revision);
          },
          showInHistory: (changesetId) => {
            card.close();
            links.showInHistory(changesetId);
          },
        }}
      />
      <span className="visually-hidden" aria-live="polite">
        {activeBlock &&
          `Lines ${activeBlock.start + 1} to ${activeBlock.end}: changeset ${activeBlock.changeset.changesetId} by ${displayName(activeBlock.changeset.owner)}`}
      </span>
    </div>
  );
}
