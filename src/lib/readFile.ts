import { loadTable } from './duckdb';
import type { Dataset } from './types';

/** Hands the bytes to DuckDB and keeps only the shape of what came back. */
export async function loadDataset(id: string, name: string, buffer: ArrayBuffer): Promise<Dataset> {
    const { table, alias, columns, rowCount } = await loadTable(id, name, buffer);
    return { name, table, alias, columns, rowCount };
}
