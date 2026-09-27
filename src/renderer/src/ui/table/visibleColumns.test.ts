import { describe, expect, it } from 'vitest';
import type { Column } from './DataTable';
import { visibleColumns } from './visibleColumns';

const column = (id: string, hideBelow?: number): Column<unknown> => ({ id, header: id, hideBelow, render: () => null });

describe('visibleColumns', () => {
  const columns = [column('name'), column('modified', 420), column('owner', 600)];

  it('drops each column once the table is narrower than its width', () => {
    expect(visibleColumns(columns, 700).map((shown) => shown.id)).toEqual(['name', 'modified', 'owner']);
    expect(visibleColumns(columns, 420).map((shown) => shown.id)).toEqual(['name', 'modified']);
    expect(visibleColumns(columns, 419).map((shown) => shown.id)).toEqual(['name']);
  });

  it('shows every column until the table is measured', () => {
    expect(visibleColumns(columns, Infinity)).toHaveLength(3);
  });
});
