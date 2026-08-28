export type Row = Record<string, unknown>;

/** A file loaded into the engine. Rows are fetched per page, never held here. */
export interface Dataset {
    name: string;
    table: string;
    /** Readable name for the table, for use in the SQL box. */
    alias: string;
    columns: string[];
    rowCount: number;
}
