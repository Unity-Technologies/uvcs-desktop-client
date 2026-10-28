import { Facet, StateEffect, type Extension } from '@codemirror/state';
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { fencedCodeIn, tokenMarks, type FencedCode, type TokenMark } from './codeHighlight';

/** The diffs' theme the code is colored in (`pierreThemeName`), following the app's. */
export const codeTheme = Facet.define<string, string>({ combine: (values) => values[0] ?? 'pierre-light' });

const colorsArrived = StateEffect.define<null>();

/** Colors are kept per block's text, language and theme, so typing elsewhere never colors a block again. */
type Colored = TokenMark[] | 'reading' | 'none';

/**
 * Code blocks colored by the highlighter the shown comments use (Pierre's Shiki, `getSharedHighlighter`), with the
 * diffs' themes: the code reads the same while it's written and once it's shown. The highlighter loads on the first
 * block with a language, never with the editor; until a block's colors arrive it shows plain.
 */
export const codeColors: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;
    private readonly colored = new Map<string, Colored>();
    private destroyed = false;

    constructor(private readonly view: EditorView) {
      this.decorations = this.draw();
    }

    update(update: ViewUpdate): void {
      const arrived = update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(colorsArrived)));
      const themed = update.startState.facet(codeTheme) !== update.state.facet(codeTheme);
      if (update.docChanged || update.viewportChanged || arrived || themed) this.decorations = this.draw();
    }

    destroy(): void {
      this.destroyed = true;
    }

    private draw(): DecorationSet {
      const theme = this.view.state.facet(codeTheme);
      const marks: TokenMark[] = [];
      const shown = new Set<string>();
      for (const range of this.view.visibleRanges) {
        for (const block of fencedCodeIn(this.view.state, range.from, range.to)) {
          const key = `${theme}\n${block.language}\n${block.text}`;
          shown.add(key);
          const colored = this.colored.get(key);
          if (colored === undefined) this.color(key, block, theme);
          else if (Array.isArray(colored)) marks.push(...colored.map((mark) => ({ ...mark, from: mark.from + block.from, to: mark.to + block.from })));
        }
      }
      // Only the blocks on screen keep their colors: each key typed in a block makes a new one.
      for (const [key, colored] of this.colored) if (!shown.has(key) && colored !== 'reading') this.colored.delete(key);
      return Decoration.set(
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
          const { tokens } = highlighter.codeToTokens(block.text, { lang: block.language, theme });
          this.colored.set(key, tokenMarks(0, tokens));
        } catch {
          // A language the highlighter doesn't know: the block stays plain.
          this.colored.set(key, 'none');
        }
        if (!this.destroyed) this.view.dispatch({ effects: colorsArrived.of(null) });
      })();
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
