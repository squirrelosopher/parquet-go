export type Row = Record<string, unknown>;

export interface Dataset {
    name: string;
    columns: string[];
    rows: Row[];
}
