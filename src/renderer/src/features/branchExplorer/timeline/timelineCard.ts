import { formatCount, pluralize, pluralizeAtLeast } from '../../../lib/text';
import { MIN_ZOOM } from '../canvas/viewport';
import { sortedSearch } from './sortedSearch';
import { columnAtStrip, columnsBetween, type TimelineAxis } from './timelineAxis';
import { bucketAround, bucketSize, bucketTitle, dateRange, type TimelineCalendar } from './timelineCalendar';
import { frameShape, type TimelineFrame } from './timelineFrame';
import { changesetsBetween, changesetsInColumns, mainChangesetsAfter, type TimelineHistory, type TimelineShare } from './timelineHistory';
import type { HomeMark, LabelTick } from './timelineMarks';
import type { TimelineTarget } from './timelineTargets';

/** The Timeline's hover card: a title and the lines under it. */
export interface TimelineCard {
  title: string;
  lines: string[];
}

/** What a card may tell, besides what the pointer is on. */
export interface TimelineCardContext {
  history: TimelineHistory;
  share: TimelineShare;
  /** How the share is named after its count: "yours", "by ana", "by the people picked" (`shareOwners`). */
  shareWord: string;
  axis: TimelineAxis;
  calendar: TimelineCalendar;
  frame: TimelineFrame;
  zoom: number;
  home: HomeMark;
  pendingChangeCount: number;
}

/** The labels a card names before "and N more". */
const NAMED_LABELS = 3;

export function timelineCard(target: TimelineTarget, x: number, context: TimelineCardContext): TimelineCard {
  switch (target.kind) {
    case 'frame':
    case 'frameEdge':
      return frameCard(context);
    case 'home':
      return homeCard(context);
    case 'pending':
      return { title: 'Pending changes', lines: [`${pluralize(context.pendingChangeCount, 'change')} not checked in yet`] };
    case 'labels':
      return labelsCard(target.tick, context.calendar);
    case 'gap':
      return { title: `No changesets for ${pluralize(target.gap.days, 'day')}`, lines: [dateRange(target.gap.from, target.gap.to, context.calendar)] };
    case 'hits':
      return { title: pluralize(target.tick.count, 'search match', 'search matches'), lines: [] };
    case 'moment':
      return momentCard(x, context);
  }
}

/** The moment under the pointer: its hour, day or week (by the range), what was made then, and its labels. */
function momentCard(x: number, { history, share, shareWord, axis, calendar }: TimelineCardContext): TimelineCard {
  const time = history.columnTimes[columnAtStrip(axis, x)]!;
  const bucket = bucketAround(time, bucketSize(history.end - history.start), calendar);
  const made = changesetsBetween(history.times, bucket.start, bucket.end);
  const theirs = changesetsBetween(share.times, bucket.start, bucket.end);
  const merged = changesetsBetween(history.mainMergeTimes, bucket.start, bucket.end);
  const counts = [
    pluralize(made, 'changeset'),
    ...(theirs > 0 ? [`${formatCount(theirs)} ${shareWord}`] : []),
    ...(merged > 0 ? [`${formatCount(merged)} merged to /main`] : []),
  ];
  const first = sortedSearch.lowerBound(history.labelTimes, bucket.start);
  const end = sortedSearch.lowerBound(history.labelTimes, bucket.end);
  const labels = history.labels.slice(first, end).map(({ label }) => label.name).reverse();
  return { title: bucketTitle(bucket, calendar), lines: [counts.join(' · '), ...(labels.length > 0 ? [namedLabels(labels)] : [])] };
}

/** The frame: the dates on screen, the zoom, how many changesets show, and how to move it. */
function frameCard({ history, axis, frame, zoom, calendar }: TimelineCardContext): TimelineCard {
  const { first, last } = columnsBetween(axis, frame.left, frame.right);
  const onScreen = changesetsInColumns(history, first, last);
  return {
    title: last < first ? 'No changesets on screen' : dateRange(history.columnTimes[first]!, history.columnTimes[last]!, calendar),
    lines: [`Zoom ${Math.round(zoom * 100)}%`, `On screen: ${pluralize(onScreen, 'changeset')}`, frameHint(frame, zoom)],
  };
}

/** How to move the frame: its edges zoom once it is wide enough to hold them; narrower, zooming out widens it, if it can. */
function frameHint(frame: TimelineFrame, zoom: number): string {
  if (frameShape(frame) === 'boxWithEdges') return 'Drag to move · drag an edge to zoom';
  return zoom > MIN_ZOOM ? 'Drag to move · zoom out to widen it' : 'Drag to move';
}

/** The workspace: which changeset it loaded and how far /main moved on since; or that it is older than the range. */
function homeCard({ history, home }: TimelineCardContext): TimelineCard {
  if (home?.kind === 'olderThanRange') {
    return {
      title: 'Your workspace',
      lines: [`On changeset ${home.changeset}, older than the history shown`, `/main moved on ${pluralizeAtLeast(history.mainIds.length, true, 'changeset')} since`],
    };
  }
  const changeset = home?.changeset ?? 0;
  const movedOn = mainChangesetsAfter(history, changeset);
  return {
    title: 'Your workspace',
    lines: [`On changeset ${changeset}`, movedOn === 0 ? "/main hasn't moved on since" : `/main moved on ${pluralize(movedOn, 'changeset')} since`],
  };
}

/** A label tick: its label's name, or how many it holds, the newest named first, and when. */
function labelsCard(tick: LabelTick, calendar: TimelineCalendar): TimelineCard {
  const names = tick.labels.map(({ label }) => label.name).reverse();
  const when = dateRange(tick.labels[0]!.time, tick.labels.at(-1)!.time, calendar);
  if (names.length === 1) return { title: names[0]!, lines: [when] };
  return { title: pluralize(names.length, 'label'), lines: [namedLabels(names), when] };
}

/** "v3, v2, v1 and 4 more". */
export function namedLabels(names: readonly string[]): string {
  const named = names.slice(0, NAMED_LABELS).join(', ');
  return names.length > NAMED_LABELS ? `${named} and ${formatCount(names.length - NAMED_LABELS)} more` : named;
}
