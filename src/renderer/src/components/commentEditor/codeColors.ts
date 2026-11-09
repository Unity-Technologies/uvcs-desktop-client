import { Facet, StateEffect, type Extension } from '@codemirror/state';
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { fencedCodeIn, tokenMarks, type FencedCode, type TokenMark } from './codeHighlight';
import { codeColorsAfter, mapMarks, type Colored } from './codeColorDrawing';
import { colorArrival, type ColorArrival } from './colorArrival';

/** The diffs' theme the code is colored in (`pierreThemeName`), following the app's. */
export const codeTheme = Facet.define<string, string>({ combine: (values) => values[0] ?? 'pierre-light' });

const colorsArrived = StateEffect.define<null>();

const TOKENIZED_LINE_LENGTH = 1000;

/**
 * Code blocks colored by the highlighter the shown comments use (Pierre's Shiki, `getSharedHighlighter`), with the
 * diffs' themes: the code reads the same while it's written and once it's shown. The highlighter loads on the first
 * block with a language, never with the editor; until a block's colors arrive it shows plain.
 *
 * While typing, the colors drawn move with the text (`mapMarks`) and stay until the edited block's new ones replace
 * them, once typing pauses (`codeColorsAfter`, `colorArrival`): code never shows without its colors as it's typed.
 */
export const codeColors: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;
    private marks: TokenMark[] = [];
    /**
     * Colors are kept per block's text, language and theme: typing elsewhere never colors a block again, and only the
     * block being edited is tokenized at each key, a small one at that (`highlightedLanguage`).
     */
    private readonly colored = new Map<string, Colored>();
    private readonly arrival: ColorArrival;
    private destroyed = false;

    constructor(private readonly view: EditorView) {
      this.arrival = colorArrival(
        () => {
          if (!this.destroyed) this.view.dispatch({ effects: colorsArrived.of(null) });
        },
        () => performance.now(),
      );
      this.draw([]);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged) this.arrival.typed();
      const arrived = update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(colorsArrived)));
      // Another theme's colors would be wrong to keep: the blocks show plain until theirs arrive, as at the first load.
      const themed = update.startState.facet(codeTheme) !== update.state.facet(codeTheme);
      if (themed) this.draw([]);
      else if (update.docChanged || update.viewportChanged || arrived) this.draw(update.docChanged ? mapMarks(this.marks, update.changes) : this.marks);
    }

    destroy(): void {
      this.destroyed = true;
      this.arrival.stop();
    }

    private draw(kept: readonly TokenMark[]): void {
      const theme = this.view.state.facet(codeTheme);
      const keyOf = (block: FencedCode): string => `${theme}\n${block.language}\n${block.text}`;
      const blocks = this.view.visibleRanges.flatMap((range) => fencedCodeIn(this.view.state, range.from, range.to));
      const { marks, uncolored } = codeColorsAfter(blocks, (block) => this.colored.get(keyOf(block)), kept);
      for (const block of uncolored) this.color(keyOf(block), block, theme);
      // Only the blocks on screen keep their colors: each key typed in a block makes a new one.
      const shown = new Set(blocks.map(keyOf));
      for (const [key, colored] of this.colored) if (!shown.has(key) && colored !== 'reading') this.colored.delete(key);
      this.marks = marks;
      this.decorations = Decoration.set(
        marks.map((mark) => Decoration.mark({ attributes: { style: mark.style } }).range(mark.from, mark.to)),
        true,
      );
    }

    private color(key: string, block: FencedCode, theme: string): void {
      this.colored.set(key, 'reading');
      void (async () => {
        try {
          const { getSharedHighlighter } = await import('@pierre/diffs');
          const highlighter = await getSharedHighlighter({ themes: ['pierre-light', 'pierre-dark'], langs: [] });
          await highlighter.loadLanguages([block.language]);
          // No line past 1,000 characters is tokenized (a minified one), as `HighlightedCodeBlock` does.
          const { tokens } = highlighter.codeToTokens(block.text, { lang: block.language, theme, tokenizeMaxLineLength: TOKENIZED_LINE_LENGTH });
          this.colored.set(key, tokenMarks(0, tokens));
        } catch {
          // A language the highlighter doesn't know: the block stays plain.
          this.colored.set(key, 'none');
        }
        this.arrival.arrived();
      })();
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
