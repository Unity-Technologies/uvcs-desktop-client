import type { DirectoryConflictType } from '@shared/domain/merge';

interface ConflictWords {
  title: string;
  explanation: string;
}

/**
 * What each kind of directory conflict is called and why it needs the user, in plain words: `cm` names them in its own
 * jargon ("Evil twin conflict", "Change/Delete conflict"). Neither side is named: which one is "yours" depends on the
 * merge, and the choices below the title say what each side did. An xlink conflict keeps `cm`'s words.
 */
const WORDS: Partial<Record<DirectoryConflictType, ConflictWords>> = {
  evilTwin: { title: 'Added on both sides with the same name', explanation: 'Each side added a different item here. Keep one, or both under different names.' },
  movedEvilTwin: { title: 'Moved to the same place on both sides', explanation: 'Each side moved a different item here. Keep one, or both under different names.' },
  changeDelete: { title: 'Changed on one side, deleted on the other', explanation: 'Keep the changed item, or delete it.' },
  deleteChange: { title: 'Deleted on one side, changed on the other', explanation: 'Delete the item, or keep it changed.' },
  moveDelete: { title: 'Moved on one side, deleted on the other', explanation: 'Keep the moved item, or delete it.' },
  deleteMove: { title: 'Deleted on one side, moved on the other', explanation: 'Delete the item, or keep it moved.' },
  divergentMove: { title: 'Moved to different places on each side', explanation: 'An item can be in one place only. Pick where it goes.' },
  cycleMove: { title: 'Moved into each other', explanation: 'Each side moved a folder inside the other. Pick which move stays.' },
  loadedTwice: { title: 'In two places at once', explanation: 'The merge would put the same item in two places. Pick which one stays.' },
  addMove: { title: 'Added where the other side moved an item', explanation: 'Keep one, or both under different names.' },
  moveAdd: { title: 'Moved where the other side added an item', explanation: 'Keep one, or both under different names.' },
};

/** The plain words for a directory conflict, or `cm`'s own where there are none. */
export function directoryConflictWords(type: DirectoryConflictType, cmTitle: string, cmExplanation: string): ConflictWords {
  return WORDS[type] ?? { title: cmTitle, explanation: cmExplanation };
}
