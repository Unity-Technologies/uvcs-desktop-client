import type { MouseEvent } from 'react';
import { CommentLine } from '../comments/CommentLine';
import type { TableCell, TableModel } from './tableModel';
import styles from './LiveCommentEditor.module.css';

interface EditorTableProps {
  table: TableModel;
  /** A press on a cell, with where its text ends: the caret goes there, and the table shows as typed. */
  onCellPressed: (at: number) => void;
}

/** A table in the comment being written, drawn as the shown comment draws it (`Markdown`'s table). */
export function EditorTable({ table, onCellPressed }: EditorTableProps) {
  const columns = Math.max(table.align.length, table.header.length);
  const press = (cell: TableCell | undefined) => (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onCellPressed(cell?.to ?? table.header[0]?.to ?? table.from);
  };
  const cells = (row: readonly TableCell[], Cell: 'th' | 'td') =>
    Array.from({ length: columns }, (_, column) => (
      <Cell key={column} style={{ textAlign: table.align[column] ?? undefined }} onMouseDown={press(row[column])}>
        {row[column] && <CommentLine comment={row[column].text} interactive={false} />}
      </Cell>
    ));
  return (
    <div className={styles.table} data-selected={table.selected || undefined}>
      <table>
        <thead>
          <tr>{cells(table.header, 'th')}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>{cells(row, 'td')}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
