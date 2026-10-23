import { Editor } from '@pierre/diffs/edit';
import type { EditProvider } from '@pierre/diffs/react';
import type { ComponentProps } from 'react';
import { pierreEditorKeymap } from './pierreSearchPanel';

/** What `EditProvider` calls to create an editor for a component it attaches one to. */
export type CreateEditor = ComponentProps<typeof EditProvider>['createEditor'];

/**
 * Every editor the app creates (a diff's, the whole file's, a merge's hand-editing): Pierre's, with the registry's keys
 * where they differ from its own (`pierreEditorKeymap`).
 */
export const createAppEditor: CreateEditor = (type, options, key) => new Editor(type, { ...options, keymap: pierreEditorKeymap() }, key);
