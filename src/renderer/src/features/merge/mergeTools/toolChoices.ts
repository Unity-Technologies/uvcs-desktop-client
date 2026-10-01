import { Check } from 'lucide-react';
import type { MergeTool } from '@shared/domain/mergeTools';
import type { Action } from '../../../lib/actions';

export interface ToolChoice {
  tool: MergeTool;
  label: string;
}

/**
 * The merge tools behind a split button's caret, as a choice like Checkin's: the button's tool is checked, and picking
 * another only makes it the button's tool (`select`, the preferred one). Nothing opens until the user clicks the button
 * that names it.
 */
export function toolChoiceEntries(choices: ToolChoice[], selectedId: string | undefined, select: (toolId: string) => void): Action[] {
  return choices.map(({ tool, label }) => ({
    id: tool.id,
    label,
    icon: tool.id === selectedId ? Check : undefined,
    run: () => {
      if (tool.id !== selectedId) select(tool.id);
    },
  }));
}
