import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { prefersReducedMotion } from '../../../lib/reducedMotion';
import { listScrollTop } from '../../../lib/scrollPlacement';
import { hotkey } from '../../../lib/shortcutRegistry';
import { EmptyState } from '../../../ui/EmptyState';
import { IconButton } from '../../../ui/IconButton';
import { Highlight, HighlightQuery } from '../../../ui/Highlight';
import { NoMatches } from '../../../ui/NoMatches';
import { SearchField } from '../../../ui/SearchField';
import { ToggleChip } from '../../../ui/ToggleChip';
import { Tooltip } from '../../../ui/Tooltip';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { SkeletonBar } from '../../../ui/Skeleton';
import { ItemIcon } from '../../../components/ItemIcon';
import { ThreadSummaryCard, ThreadSummaryRow } from '../conversation/ReviewThreadCard';
import { threadKindName } from '../conversation/threadBadges';
import { THREAD_KIND_ICONS } from '../conversation/ThreadKindIcon';
import {
  commentPosition,
  commentsPanelCounts,
  type CommentsFileGroup,
  type CommentsOrder,
  emptyCommentsText,
  isSearching,
  matchExcerpt,
  NO_COMMENTS_SEARCH,
  steppedThread,
  THREAD_KINDS,
  threadKindChipLabel,
  threadKindCounts,
  type CommentsFilter,
  type CommentsSearch,
  type ThreadKind,
} from './commentsPanel';
import type { LineThread } from './fileThreads';
import { CommentsOrderMenu } from './CommentsOrderMenu';
import type { ReviewComments } from './reviewComments';
import styles from './ReviewCommentsPanel.module.css';

interface ReviewCommentsPanelProps {
  comments: ReviewComments;
  /** What it lists, kept by the Changes tab so the keys go through the same comments while it's hidden. */
  filter: CommentsFilter;
  onFilterChange: (filter: CommentsFilter) => void;
  /** The words and kinds the filter row narrows it to, kept by the Changes tab too. */
  search: CommentsSearch;
  onSearchChange: (search: CommentsSearch) => void;
  listed: readonly LineThread[];
  /** How they're ordered, kept for every review; in the code's order, `listed` under their files (`groups`). */
  order: CommentsOrder;
  onOrderChange: (order: CommentsOrder) => void;
  groups: readonly CommentsFileGroup[] | null;
  /** Shows a file's diff, its group's name clicked. */
  onOpenFile: (path: string) => void;
  /** Every comment, in the order the panel lists them: where one that left the list sat. */
  all: readonly LineThread[];
  /** Goes to the comment after or before the one gone to (`steppedThread`). */
  onStep: (direction: 1 | -1) => void;
  onClose: () => void;
}

/**
 * Beside a review's Changes: every comment on its code, or what's still open. In the code's order, under each file's
 * name, a row per thread; newest or oldest first, each as the conversation shows a settled thread. A click goes to the
 * thread, in the mode it was written in (`goToThread`); the arrows (N, ⇧N) go through them one by one, in the order
 * shown.
 */
export function ReviewCommentsPanel({ comments, ...props }: ReviewCommentsPanelProps) {
  const { threads } = comments;
  return (
    <aside className={styles.panel} aria-label="Comments">
      {threads ? <PanelBody comments={comments} threads={threads} {...props} /> : <Loading />}
    </aside>
  );
}

function PanelBody({ comments, threads, filter, onFilterChange, search, onSearchChange, listed, order, onOrderChange, groups, onOpenFile, all, onStep, onClose }: ReviewCommentsPanelProps & { threads: NonNullable<ReviewComments['threads']> }) {
  const counts = commentsPanelCounts(threads);
  const empty = emptyCommentsText(filter, counts);
  const current = comments.focus?.threadId;
  const { seeInContext } = comments;
  const listRef = useRef<HTMLDivElement>(null);
  useFollowedCard(listRef, comments.focus?.seq);
  return (
    <>
      <header className={styles.header}>
        <h2 className={styles.title}>Comments</h2>
        <SegmentedControl<CommentsFilter>
          label="Comments to list"
          value={filter}
          onChange={onFilterChange}
          segments={[
            { value: 'open', label: `Open ${counts.open}`, title: 'Change requests to apply or discard, and questions to answer' },
            { value: 'all', label: `All ${counts.all}`, title: 'Every comment on the code' },
          ]}
        />
        {/* As the diff header's toggle does: the panel stays hidden until it's shown again. */}
        <IconButton size="small" icon={<X size={14} />} label="Hide Comments panel" onClick={onClose} />
      </header>
      {counts.all > 0 && <SearchRow search={search} onChange={onSearchChange} kindCounts={threadKindCounts(threads, filter)} />}
      {listed.length > 0 && (
        <div className={styles.stepper}>
          <span className={styles.position}>{commentPosition(listed, current, groups)}</span>
          <CommentsOrderMenu order={order} onChange={onOrderChange} />
          <IconButton size="small" icon={<ChevronUp size={14} />} label="Previous comment" shortcut={hotkey('previousComment')} disabled={steppedThread(listed, all, current, -1) === null} onClick={() => onStep(-1)} />
          <IconButton size="small" icon={<ChevronDown size={14} />} label="Next comment" shortcut={hotkey('nextComment')} disabled={steppedThread(listed, all, current, 1) === null} onClick={() => onStep(1)} />
        </div>
      )}
      {listed.length === 0 && isSearching(search) ? (
        <NoMatches noun="comments" onClear={() => onSearchChange(NO_COMMENTS_SEARCH)} />
      ) : listed.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <HighlightQuery query={search.query}>
          {/* Where the card gone to is looked for (`useFollowedCard`), around either list. */}
          <div ref={listRef} className={styles.listArea}>
          {groups ? (
            <div className={styles.groups}>
              {groups.map((group) => (
                <FileGroup key={group.path} group={group} onOpenFile={() => onOpenFile(group.path)}>
                  {group.threads.map((thread) => (
                    <li key={thread.root.id}>
                      <ThreadSummaryRow
                        thread={thread}
                        current={current === thread.root.id}
                        onOpen={() => comments.goToThread(thread)}
                        onSeeApplied={seeInContext && (() => seeInContext(thread, { startsOn: 'since' }))}
                        excerpt={matchExcerpt(thread, search.query)}
                        lineDigits={group.lineDigits}
                      />
                    </li>
                  ))}
                </FileGroup>
              ))}
            </div>
          ) : (
            <ul className={styles.list}>
              {listed.map((thread) => (
                <li key={thread.root.id}>
                  <ThreadSummaryCard
                    reviewId={comments.review.id}
                    thread={thread}
                    current={current === thread.root.id}
                    onOpen={() => comments.goToThread(thread)}
                    onSeeApplied={seeInContext && (() => seeInContext(thread, { startsOn: 'since' }))}
                    excerpt={matchExcerpt(thread, search.query)}
                  />
                </li>
              ))}
            </ul>
          )}
          </div>
        </HighlightQuery>
      )}
    </>
  );
}

/**
 * A file's comments under its name, which stays at the top while they scroll: the name, its folder (cut from the
 * start, the folder nearest the file staying), and how many. The name shows the file's diff.
 */
function FileGroup({ group, onOpenFile, children }: { group: CommentsFileGroup; onOpenFile: () => void; children: ReactNode }) {
  return (
    <section className={styles.group} aria-label={group.path}>
      <button type="button" className={styles.groupHeader} data-tip="Show the file" data-tip-sub={group.path} onClick={onOpenFile}>
        <ItemIcon itemType="file" name={group.file} />
        <span className={styles.groupFile}>
          <Highlight text={group.file} />
        </span>
        {group.folder && (
          // Cut from its start (`direction: rtl`); the path itself still reads left to right.
          <span className={styles.groupFolder}>
            <bdi>
              <Highlight text={group.folder} />
            </bdi>
          </span>
        )}
        <span className={styles.groupCount}>{group.threads.length}</span>
      </button>
      <ul className={styles.groupRows}>{children}</ul>
    </section>
  );
}

interface SearchRowProps {
  search: CommentsSearch;
  onChange: (search: CommentsSearch) => void;
  kindCounts: Record<ThreadKind, number>;
}

/** Words to find in what was said, and a chip per kind, each its icon and how many Open or All lists. */
function SearchRow({ search, onChange, kindCounts }: SearchRowProps) {
  const toggle = (kind: ThreadKind): void => {
    const kinds = new Set(search.kinds);
    if (kinds.has(kind)) kinds.delete(kind);
    else kinds.add(kind);
    onChange({ ...search, kinds });
  };
  return (
    <div className={styles.search}>
      {/* Not the view's ⌘F field: that one is the files'. */}
      <SearchField value={search.query} onChange={(query) => onChange({ ...search, query })} placeholder="Filter comments" width="100%" aria-label="Filter comments" />
      {THREAD_KINDS.map((kind) => {
        const Icon = THREAD_KIND_ICONS[threadKindName({ kind })];
        const label = threadKindChipLabel(kind, kindCounts[kind]);
        return (
          <Tooltip key={kind} content={label}>
            <ToggleChip size="small" pressed={search.kinds.has(kind)} onChange={() => toggle(kind)} icon={<Icon size={12} />} aria-label={label}>
              {kindCounts[kind]}
            </ToggleChip>
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * Each time a comment is gone to (a card, the arrows, N), its card is brought into the list's view, a third of the way
 * down (`listScrollTop`), gliding unless motion is reduced. The focus, when a
 * card before held it, goes along to the current card's first control: left behind, the key pressed draws its ring on a
 * comment no longer the current one. Drawn without a ring (`focusVisible`), it keeps a keyboard user's place in the list.
 */
function useFollowedCard(listRef: RefObject<HTMLElement | null>, focusSeq: number | undefined): void {
  // Before the paint: the ring the key drew on the card left never shows.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || focusSeq === undefined) return;
    const card = list.querySelector('[data-current]');
    if (card) bringIntoList(card);
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement) || !list.contains(focused) || card?.contains(focused)) return;
    const control = card?.querySelector<HTMLElement>('button');
    // `focusVisible` is Chromium's, not yet in TypeScript's DOM types.
    const options: FocusOptions & { focusVisible?: boolean } = { preventScroll: true, focusVisible: false };
    if (control) control.focus(options);
    else focused.blur();
  }, [listRef, focusSeq]);
}

/** Where each list was last sent, while it glides there: N pressed again measures from it, not from mid-glide. */
const aimedAt = new WeakMap<HTMLElement, number>();

function bringIntoList(card: Element): void {
  const scroller = scrollingParent(card);
  if (!scroller) return;
  const view = scroller.getBoundingClientRect();
  const box = card.getBoundingClientRect();
  const scrollTop = aimedAt.get(scroller) ?? scroller.scrollTop;
  const top = box.top - view.top + scroller.scrollTop;
  const to = listScrollTop({ top, bottom: top + box.height }, { scrollTop, height: scroller.clientHeight, contentHeight: scroller.scrollHeight });
  if (to === null || Math.abs(to - scroller.scrollTop) < 1) return;
  aimedAt.set(scroller, to);
  scroller.addEventListener('scrollend', () => aimedAt.delete(scroller), { once: true });
  scroller.scrollTo({ top: to, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function scrollingParent(element: Element): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY)) return parent;
  }
  return null;
}

function Loading() {
  return (
    <div className={styles.loading} aria-busy="true" aria-label="Loading">
      <SkeletonBar width="50%" />
      <SkeletonBar width="80%" />
      <SkeletonBar width="65%" />
    </div>
  );
}
