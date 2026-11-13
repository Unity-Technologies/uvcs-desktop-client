import { sharingModifiers } from '../../lib/shortcuts';
import { hotkey, hotkeys } from '../../lib/shortcutRegistry';
import { KeyHints, type KeyHint } from '../../ui/KeyHints';

/** The keys that drive the palette, on one line; the scope's too where it has scope chips (`scopeChipsFor`). */
export function PaletteFooter({ changesScope }: { changesScope: boolean }) {
  const hints: KeyHint[] = [
    { keys: hotkeys('paletteMove'), label: 'move' },
    { keys: hotkey('paletteOpen'), label: 'open' },
    { keys: hotkey('rowActions'), label: 'actions' },
    ...(changesScope ? [{ keys: sharingModifiers(hotkeys('paletteScope')), label: 'change scope', atEnd: true }] : []),
  ];
  return <KeyHints hints={hints} oneLine />;
}
