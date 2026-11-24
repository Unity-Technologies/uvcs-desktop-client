import { createContext } from 'react';

/**
 * The path of the file the comments' fields inside are on (a review's line comment, its replies and edits), whose
 * language a ```suggestion fence is colored in (`withCommentedFile`). None outside such a comment.
 */
export const CommentedFileContext = createContext<string | null>(null);
