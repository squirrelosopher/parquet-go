export type Row = Record<string, unknown>;

/** A file loaded into the engine. Rows are fetched per page, never held here. */
export interface Dataset {
    name: string;
    /** Named after the file, so a query in the SQL box reads the way the file does. */
    table: string;
    columns: string[];
    rowCount: number;
}
