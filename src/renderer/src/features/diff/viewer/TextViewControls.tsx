import { Columns2, FoldVertical, Rows2, WrapText } from 'lucide-react';
import { IconButton } from '../../../ui/IconButton';
import { PaneToolbarGroup } from '../../../ui/PaneToolbar';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { ComparisonMethodMenu } from './ComparisonMethodMenu';
import { useDiffPreferences, type DiffLayout } from './diffPreferencesStore';
import { hasLineChanges, type LineDiff } from './lineDiff';
import { LineStats } from './LineStats';
import { PlainTextIndicator } from './PlainTextIndicator';

interface TextViewControlsProps {
  /** The diff of the text as it is now: its +N −M. */
  diff: LineDiff | null;
  /** The text shows without syntax highlighting (`syntaxHighlighting` is off). */
  plainText: boolean;
  /** Split | Unified changes how the diff shows (`followsLayout`). */
  followsLayout: boolean;
}

/** The header's ways of viewing a text's lines: its size note and +N −M, the comparison method, collapse, wrap, Split | Unified. */
export function TextViewControls({ diff, plainText, followsLayout }: TextViewControlsProps) {
  const { layout, collapseUnchanged, wrapLines, comparisonMethod, setLayout, setCollapseUnchanged, setWrapLines, setComparisonMethod } = useDiffPreferences();
  return (
    <>
      {/* Said in the header, not over the diff: a note there would stack on "No content changes". */}
      {plainText && <PlainTextIndicator />}
      {diff && hasLineChanges(diff) && <LineStats added={diff.added} removed={diff.removed} />}
      <PaneToolbarGroup>
        <ComparisonMethodMenu value={comparisonMethod} onChange={setComparisonMethod} />
        <IconButton
          size="small"
          icon={<FoldVertical size={14} />}
          label={collapseUnchanged ? 'Show all lines' : 'Collapse unchanged lines'}
          variant={collapseUnchanged ? 'secondary' : 'ghost'}
          onClick={() => setCollapseUnchanged(!collapseUnchanged)}
        />
        <IconButton
          size="small"
          icon={<WrapText size={14} />}
          label={wrapLines ? "Don't wrap lines" : 'Wrap lines'}
          variant={wrapLines ? 'secondary' : 'ghost'}
          onClick={() => setWrapLines(!wrapLines)}
        />
      </PaneToolbarGroup>
      {followsLayout && (
        <SegmentedControl<DiffLayout>
          value={layout}
          onChange={setLayout}
          segments={[
            { value: 'split', label: <><Columns2 size={13} /> <span data-toolbar-label>Split</span></>, title: 'Side-by-side view' },
            { value: 'unified', label: <><Rows2 size={13} /> <span data-toolbar-label>Unified</span></>, title: 'Unified view' },
          ]}
        />
      )}
    </>
  );
}
